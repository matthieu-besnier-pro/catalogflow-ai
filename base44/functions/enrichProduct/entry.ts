import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Tente de récupérer l'image depuis Agrizone en scrapant la page produit
async function fetchAgrizoneImage(reference) {
  try {
    const searchUrl = `https://www.agrizone.net/recherche?q=${encodeURIComponent(reference)}`;
    const res = await fetch(searchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CatalogBot/1.0)' },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Cherche le premier lien produit dans les résultats de recherche
    const productLinkMatch = html.match(/href="(\/[^"]*\/p\/[^"]+)"/);
    if (!productLinkMatch) return null;

    const productUrl = `https://www.agrizone.net${productLinkMatch[1]}`;
    const productRes = await fetch(productUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CatalogBot/1.0)' },
      signal: AbortSignal.timeout(8000)
    });
    if (!productRes.ok) return null;
    const productHtml = await productRes.text();

    // Cherche l'image principale du produit (og:image ou balise img principale)
    const ogImageMatch = productHtml.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)
      || productHtml.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i);
    if (ogImageMatch) return { url: ogImageMatch[1], source: productUrl };

    // Fallback: cherche une img avec classe type "product" ou "main"
    const imgMatch = productHtml.match(/<img[^>]+(?:class="[^"]*(?:product|main|principal)[^"]*"|id="[^"]*(?:product|main)[^"]*")[^>]+src="([^"]+\.(jpg|jpeg|png|webp))"/i);
    if (imgMatch) return { url: imgMatch[1].startsWith('http') ? imgMatch[1] : `https://www.agrizone.net${imgMatch[1]}`, source: productUrl };

    return null;
  } catch {
    return null;
  }
}

// Tente de récupérer l'image via la recherche Google Images (via scraping léger)
async function fetchGoogleImage(query) {
  try {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query + ' photo produit')}&tbm=isch&num=5`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'fr-FR,fr;q=0.9'
      },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Cherche les URLs d'images directes dans la réponse
    const imgMatches = [...html.matchAll(/"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp))"/gi)];
    for (const match of imgMatches) {
      const url = match[1];
      // Filtre les URLs Google et petites icônes
      if (!url.includes('google') && !url.includes('gstatic') && url.length > 50) {
        return { url, source: 'Google Images' };
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Valide qu'une URL pointe bien vers une image accessible
async function validateImageUrl(url) {
  if (!url || !url.match(/\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i)) return false;
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000)
    });
    return res.ok && (res.headers.get('content-type') || '').startsWith('image/');
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });

    const { productId } = await req.json();
    if (!productId) return Response.json({ error: 'productId requis' }, { status: 400 });

    const products = await base44.entities.Product.filter({ id: productId });
    if (!products || products.length === 0) return Response.json({ error: 'Produit non trouvé' }, { status: 404 });
    const product = products[0];

    const searchQuery = product.intitule_origine
      ? `${product.reference} ${product.intitule_origine}`
      : product.reference;

    // Étape 1 : Recherche parallèle d'images (Agrizone + Google Images)
    const [agrizoneResult, googleResult] = await Promise.all([
      fetchAgrizoneImage(product.reference),
      fetchGoogleImage(searchQuery)
    ]);

    // Étape 2 : Enrichissement LLM avec contexte sur les images déjà trouvées
    const preFoundImages = [];
    if (agrizoneResult) preFoundImages.push(`- Agrizone: ${agrizoneResult.url} (page: ${agrizoneResult.source})`);
    if (googleResult) preFoundImages.push(`- Google Images: ${googleResult.url}`);

    const enrichmentResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Tu es un expert en recherche de produits industriels et agricoles.
Recherche sur internet les informations sur ce produit:
- Référence: ${product.reference}
- Libellé produit: ${product.intitule_origine || 'non fourni'}
- Requête de recherche: "${searchQuery}"

SOURCES PRIORITAIRES À CONSULTER (dans cet ordre):
1. agrizone.net - recherche la référence ${product.reference} sur https://www.agrizone.net/recherche?q=${encodeURIComponent(product.reference)}
2. Sites fabricants directs (page officielle du produit)
3. Distributeurs spécialisés (rs-components.com, farnell.com, conrad.fr, manomano.fr, leroymerlin.fr, amazon.fr)

${preFoundImages.length > 0 ? `URLs d'images pré-trouvées automatiquement (UTILISE-LES EN PRIORITÉ si elles semblent correctes):
${preFoundImages.join('\n')}

` : ''}RÈGLES ABSOLUES POUR photo_url:
- Doit être une URL DIRECTE vers un fichier image (.jpg, .jpeg, .png, .webp) — JAMAIS une page web
- L'URL doit être accessible publiquement
- Préfère les images haute résolution des sites officiels
- Si les URLs pré-trouvées ci-dessus correspondent au produit, utilise-les

Fournis:
- designation: Désignation commerciale complète en français
- petit_descriptif: Description courte (2-3 phrases) pour catalogue professionnel
- photo_url: URL directe image (.jpg/.png/.webp) — mets la meilleure URL trouvée
- marque: Marque identifiée avec certitude
- categorie: Catégorie produit précise
- source_info: URL de la page produit officielle
- source_image: Nom du site source de l'image (ex: "agrizone.net", "fabricant-direct.fr")
- niveau_confiance: "Élevé" si ref exacte trouvée, "Moyen" si bonne correspondance, "Faible" sinon
- statut_validation: "Validé" si photo+infos OK, "Validé partiel" si infos sans photo, "À vérifier" si doute, "Introuvable" si rien
- commentaire: Remarques utiles notamment sur la qualité de la correspondance`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          designation: { type: "string" },
          petit_descriptif: { type: "string" },
          photo_url: { type: "string" },
          marque: { type: "string" },
          categorie: { type: "string" },
          source_info: { type: "string" },
          source_image: { type: "string" },
          niveau_confiance: { type: "string", enum: ["Élevé", "Moyen", "Faible"] },
          statut_validation: { type: "string", enum: ["Validé", "Validé partiel", "À vérifier", "Introuvable"] },
          commentaire: { type: "string" }
        }
      }
    });

    // Étape 3 : Sélection de la meilleure image avec validation
    let finalPhotoUrl = '';
    let finalSourceImage = '';

    // Ordre de priorité : LLM > Agrizone > Google
    const candidateImages = [
      enrichmentResult.photo_url ? { url: enrichmentResult.photo_url, source: enrichmentResult.source_image || 'LLM' } : null,
      agrizoneResult,
      googleResult
    ].filter(Boolean);

    for (const candidate of candidateImages) {
      const isValid = await validateImageUrl(candidate.url);
      if (isValid) {
        finalPhotoUrl = candidate.url;
        finalSourceImage = candidate.source || '';
        break;
      }
    }

    // Si aucune image validée, garde l'URL LLM sans validation (peut quand même fonctionner)
    if (!finalPhotoUrl && enrichmentResult.photo_url) {
      finalPhotoUrl = enrichmentResult.photo_url;
      finalSourceImage = enrichmentResult.source_image || '';
    }

    let finalComment = product.commentaire || '';
    const llmComment = enrichmentResult.commentaire || '';
    if (!finalPhotoUrl) llmComment ? llmComment + ' | Aucune image validée trouvée' : 'Aucune image trouvée';
    if (llmComment) finalComment = finalComment ? `${finalComment} | ${llmComment}` : llmComment;

    const updateData = {
      designation: enrichmentResult.designation || '',
      petit_descriptif: enrichmentResult.petit_descriptif || '',
      photo_url: finalPhotoUrl,
      marque: enrichmentResult.marque || '',
      categorie: enrichmentResult.categorie || '',
      source_info: enrichmentResult.source_info || '',
      source_image: finalSourceImage,
      niveau_confiance: enrichmentResult.niveau_confiance || 'Faible',
      statut_validation: finalPhotoUrl ? enrichmentResult.statut_validation : (enrichmentResult.statut_validation === 'Validé' ? 'Validé partiel' : enrichmentResult.statut_validation),
      commentaire: finalComment,
      enriched: true
    };

    await base44.entities.Product.update(productId, updateData);

    const batchProducts = await base44.entities.Product.filter({ batch_id: product.batch_id });
    const enrichedCount = batchProducts.filter(p => p.enriched || p.id === productId).length;
    await base44.entities.CatalogBatch.update(product.batch_id, {
      processed_products: enrichedCount,
      status: enrichedCount >= batchProducts.length ? 'termine' : 'en_cours'
    });

    return Response.json({ success: true, product: { ...product, ...updateData } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});