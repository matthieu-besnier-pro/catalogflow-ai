import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Formats d'image supportés par les navigateurs (exclut avif, pdf, svg, etc.)
const SUPPORTED_IMG_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const SUPPORTED_IMG_EXT = /\.(jpg|jpeg|png|webp|gif)(\?[^"]*)?$/i;
const BLOCKED_EXT = /\.(avif|pdf|svg|tiff|bmp|ico)(\?.*)?$/i;

// Valide qu'une URL pointe vers une image réelle, accessible, avec un content-type supporté
async function validateImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (BLOCKED_EXT.test(url)) return false;
  // Nettoie les URLs de redirection type agrizone (/fr/fstrz/r/s/c/...)
  if (url.includes('/fstrz/') || url.includes('/r/s/c/')) return false;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Range': 'bytes=0-1023'  // Télécharge seulement les premiers octets
      },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return false;
    const contentType = (res.headers.get('content-type') || '').split(';')[0].trim();
    // Consomme le body pour libérer la connexion
    await res.body?.cancel();
    return SUPPORTED_IMG_MIME.includes(contentType);
  } catch {
    return false;
  }
}

// Extrait les URLs d'images valides depuis un HTML, en filtrant les formats non supportés
function extractImageUrls(html, baseUrl) {
  const urls = [];

  // og:image (le plus fiable)
  const ogMatches = [...html.matchAll(/<meta[^>]+(?:property="og:image"|name="og:image")[^>]+content="([^"]+)"/gi),
                     ...html.matchAll(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/gi)];
  for (const m of ogMatches) urls.push(m[1]);

  // data-src et src dans les balises img (images lazy-load)
  const imgMatches = [...html.matchAll(/<img[^>]+(?:data-src|src)="([^"]+)"/gi)];
  for (const m of imgMatches) {
    const src = m[1];
    const abs = src.startsWith('http') ? src : `${baseUrl}${src.startsWith('/') ? '' : '/'}${src}`;
    urls.push(abs);
  }

  // Filtre et dédoublonne : garde uniquement les extensions supportées, exclut les bloquées
  return [...new Set(urls)].filter(u =>
    SUPPORTED_IMG_EXT.test(u.split('?')[0]) &&
    !BLOCKED_EXT.test(u) &&
    !u.includes('/fstrz/') &&
    !u.includes('placeholder') &&
    !u.includes('logo') &&
    u.length > 30
  );
}

// Scrape Agrizone pour trouver la page produit et en extraire une image valide
async function fetchAgrizoneImage(reference) {
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'fr-FR,fr;q=0.9'
    };

    // Recherche sur Agrizone
    const searchRes = await fetch(
      `https://www.agrizone.net/catalogsearch/result/?q=${encodeURIComponent(reference)}`,
      { headers, signal: AbortSignal.timeout(10000) }
    );
    if (!searchRes.ok) return null;
    const searchHtml = await searchRes.text();

    // Récupère le premier lien produit (href contenant le pattern produit Agrizone)
    const linkPatterns = [
      /href="(https?:\/\/www\.agrizone\.net\/[^"]+\.html)"/gi,
      /href="(\/[a-z0-9-]+\.html)"/gi
    ];
    let productUrl = null;
    for (const pattern of linkPatterns) {
      const match = searchHtml.match(pattern);
      if (match) {
        const href = match[0].match(/href="([^"]+)"/)[1];
        productUrl = href.startsWith('http') ? href : `https://www.agrizone.net${href}`;
        break;
      }
    }
    if (!productUrl) return null;

    // Charge la page produit
    const productRes = await fetch(productUrl, { headers, signal: AbortSignal.timeout(10000) });
    if (!productRes.ok) return null;
    const productHtml = await productRes.text();

    // Extrait toutes les images candidates
    const candidates = extractImageUrls(productHtml, 'https://www.agrizone.net');
    
    // Teste chaque candidate jusqu'à en trouver une valide
    for (const url of candidates) {
      const valid = await validateImageUrl(url);
      if (valid) return { url, source: productUrl };
    }
    return null;
  } catch {
    return null;
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

    // Étape 1 : Scraping Agrizone en priorité (résultat déjà validé pixel par pixel)
    const agrizoneResult = await fetchAgrizoneImage(product.reference);

    // Étape 2 : Enrichissement LLM en parallèle (infos + éventuellement une autre image)
    const preFoundImages = [];
    if (agrizoneResult) preFoundImages.push(`- Agrizone (VALIDÉE, utilise cette URL): ${agrizoneResult.url}`);

    const enrichmentResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Tu es un expert en recherche de produits industriels et agricoles.
Recherche sur internet les informations sur ce produit:
- Référence: ${product.reference}
- Libellé produit: ${product.intitule_origine || 'non fourni'}
- Requête de recherche: "${searchQuery}"

${agrizoneResult ? `✅ IMAGE AGRIZONE DÉJÀ TROUVÉE ET VALIDÉE — utilise impérativement cette URL pour photo_url:
${agrizoneResult.url}
Source page: ${agrizoneResult.source}

` : `CHERCHE L'IMAGE sur ces sources (dans l'ordre):
1. agrizone.net : https://www.agrizone.net/catalogsearch/result/?q=${encodeURIComponent(product.reference)}
2. Site fabricant officiel du produit
3. Distributeurs : manomano.fr, leroymerlin.fr, amazon.fr, cdiscount.com

`}RÈGLES ABSOLUES POUR photo_url:
- URL DIRECTE vers fichier image (.jpg, .jpeg, .png, .webp) UNIQUEMENT
- JAMAIS .avif, .svg, .pdf, ni URL de page web
- JAMAIS une URL contenant "/fstrz/" ou "/r/s/c/" (redirections)
- L'URL doit se terminer par .jpg, .jpeg, .png ou .webp

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

    // Étape 3 : Sélection de la meilleure image
    // Priorité : Agrizone (déjà validée) > LLM (à valider) > rien
    let finalPhotoUrl = '';
    let finalSourceImage = '';

    if (agrizoneResult) {
      // Agrizone déjà validée dans fetchAgrizoneImage, on fait confiance
      finalPhotoUrl = agrizoneResult.url;
      finalSourceImage = 'agrizone.net';
    } else if (enrichmentResult.photo_url) {
      // Valide l'URL proposée par le LLM
      const isValid = await validateImageUrl(enrichmentResult.photo_url);
      if (isValid) {
        finalPhotoUrl = enrichmentResult.photo_url;
        finalSourceImage = enrichmentResult.source_image || '';
      }
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