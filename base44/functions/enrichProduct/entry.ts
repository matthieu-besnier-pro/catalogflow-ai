import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SUPPORTED_IMG_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const BLOCKED_EXT = /\.(avif|pdf|svg|tiff|bmp|ico)(\?.*)?$/i;
const VALID_IMG_EXT = /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i;

async function validateImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (BLOCKED_EXT.test(url.split('?')[0])) return false;
  if (url.includes('/fstrz/') || url.includes('/r/s/c/')) return false;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Range': 'bytes=0-2047'
      },
      signal: AbortSignal.timeout(7000)
    });
    if (!res.ok) return false;
    const contentType = (res.headers.get('content-type') || '').split(';')[0].trim();
    await res.body?.cancel();
    return SUPPORTED_IMG_MIME.includes(contentType);
  } catch {
    return false;
  }
}

// Recherche d'images via DuckDuckGo Images API (non-officielle mais fonctionnelle)
async function fetchDuckDuckGoImages(query) {
  try {
    // Étape 1 : récupère le token vqd requis par l'API
    const tokenRes = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(8000)
    });
    if (!tokenRes.ok) return [];
    const tokenHtml = await tokenRes.text();
    const vqdMatch = tokenHtml.match(/vqd=["']?([\d-]+)["']?/);
    if (!vqdMatch) return [];
    const vqd = vqdMatch[1];

    // Étape 2 : appel API images DDG
    const imgRes = await fetch(
      `https://duckduckgo.com/i.js?q=${encodeURIComponent(query)}&vqd=${vqd}&o=json&p=1&s=0&u=bing&f=,,,&l=fr-fr`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://duckduckgo.com/'
        },
        signal: AbortSignal.timeout(8000)
      }
    );
    if (!imgRes.ok) return [];
    const data = await imgRes.json();
    return (data?.results || []).slice(0, 10).map(r => r.image).filter(Boolean);
  } catch {
    return [];
  }
}

// Scrape Agrizone pour trouver une image produit
async function fetchAgrizoneImage(reference) {
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'fr-FR,fr;q=0.9'
    };

    const searchRes = await fetch(
      `https://www.agrizone.net/catalogsearch/result/?q=${encodeURIComponent(reference)}`,
      { headers, signal: AbortSignal.timeout(10000) }
    );
    if (!searchRes.ok) return null;
    const searchHtml = await searchRes.text();

    const linkMatch = searchHtml.match(/href="(https?:\/\/www\.agrizone\.net\/[^"]+\.html)"/i);
    if (!linkMatch) return null;
    const productUrl = linkMatch[1];

    const productRes = await fetch(productUrl, { headers, signal: AbortSignal.timeout(10000) });
    if (!productRes.ok) return null;
    const productHtml = await productRes.text();

    // og:image en priorité
    const ogMatch = productHtml.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)
                 || productHtml.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i);
    if (ogMatch && VALID_IMG_EXT.test(ogMatch[1].split('?')[0]) && !BLOCKED_EXT.test(ogMatch[1])) {
      const valid = await validateImageUrl(ogMatch[1]);
      if (valid) return { url: ogMatch[1], source: productUrl };
    }

    // Images produit Agrizone directes
    const imgMatches = [...productHtml.matchAll(/(?:src|data-src)="(https?:\/\/[^"]*agrizone[^"]+\.(?:jpg|jpeg|png|webp))"/gi)];
    for (const im of imgMatches) {
      if (im[1].includes('placeholder') || im[1].includes('logo')) continue;
      const valid = await validateImageUrl(im[1]);
      if (valid) return { url: im[1], source: productUrl };
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

    // Étape 1 : Agrizone + DuckDuckGo Images + LLM (infos) en parallèle
    const [agrizoneResult, ddgImageUrls, enrichmentResult] = await Promise.all([
      fetchAgrizoneImage(product.reference),
      fetchDuckDuckGoImages(searchQuery),
      base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Tu es un expert en produits industriels et agricoles.
Recherche ce produit sur internet et retourne ses informations commerciales.
- Référence: ${product.reference}
- Libellé: ${product.intitule_origine || 'non fourni'}

Fournis :
- designation: Désignation commerciale complète en français
- petit_descriptif: Description courte (2-3 phrases) pour catalogue professionnel
- photo_url: laisse VIDE, sera rempli automatiquement
- marque: Marque identifiée
- categorie: Catégorie produit précise
- source_info: URL de la page produit officielle
- source_image: laisse VIDE
- niveau_confiance: "Élevé" si ref exacte, "Moyen" si bonne correspondance, "Faible" sinon
- statut_validation: "Validé" si infos OK, "Validé partiel" si partiel, "À vérifier" si doute, "Introuvable" si rien
- commentaire: Remarques sur la correspondance`,
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
      })
    ]);

    // Étape 2 : Sélection de la meilleure image
    // Priorité : Agrizone (scrapée) > DuckDuckGo (première valide)
    let finalPhotoUrl = '';
    let finalSourceImage = '';

    if (agrizoneResult) {
      finalPhotoUrl = agrizoneResult.url;
      finalSourceImage = 'agrizone.net';
    } else if (ddgImageUrls.length > 0) {
      // Valide les candidates en parallèle (max 5)
      const toTest = ddgImageUrls.slice(0, 5);
      const results = await Promise.all(toTest.map(u => validateImageUrl(u).then(ok => ok ? u : null)));
      const firstValid = results.find(u => u !== null);
      if (firstValid) {
        finalPhotoUrl = firstValid;
        try {
          finalSourceImage = new URL(firstValid).hostname.replace('www.', '');
        } catch {
          finalSourceImage = 'duckduckgo';
        }
      }
    }

    const updateData = {
      designation: enrichmentResult.designation || '',
      petit_descriptif: enrichmentResult.petit_descriptif || '',
      photo_url: finalPhotoUrl,
      marque: enrichmentResult.marque || '',
      categorie: enrichmentResult.categorie || '',
      source_info: enrichmentResult.source_info || '',
      source_image: finalSourceImage,
      niveau_confiance: enrichmentResult.niveau_confiance || 'Faible',
      statut_validation: finalPhotoUrl
        ? enrichmentResult.statut_validation || 'Validé partiel'
        : (enrichmentResult.statut_validation === 'Validé' ? 'Validé partiel' : enrichmentResult.statut_validation || 'À vérifier'),
      commentaire: enrichmentResult.commentaire || '',
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