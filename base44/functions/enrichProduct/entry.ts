import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SUPPORTED_IMG_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const BLOCKED_EXT = /\.(avif|pdf|svg|tiff|bmp|ico)(\?.*)?$/i;

async function validateImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (BLOCKED_EXT.test(url)) return false;
  if (url.includes('/fstrz/') || url.includes('/r/s/c/')) return false;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Range': 'bytes=0-1023'
      },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return false;
    const contentType = (res.headers.get('content-type') || '').split(';')[0].trim();
    await res.body?.cancel();
    return SUPPORTED_IMG_MIME.includes(contentType);
  } catch {
    return false;
  }
}

function extractImageUrls(html, baseUrl) {
  const urls = [];
  const ogMatches = [
    ...html.matchAll(/<meta[^>]+(?:property="og:image"|name="og:image")[^>]+content="([^"]+)"/gi),
    ...html.matchAll(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/gi)
  ];
  for (const m of ogMatches) urls.push(m[1]);

  const imgMatches = [...html.matchAll(/<img[^>]+(?:data-src|src)="([^"]+)"/gi)];
  for (const m of imgMatches) {
    const src = m[1];
    const abs = src.startsWith('http') ? src : `${baseUrl}${src.startsWith('/') ? '' : '/'}${src}`;
    urls.push(abs);
  }

  return [...new Set(urls)].filter(u =>
    /\.(jpg|jpeg|png|webp|gif)(\?[^"]*)?$/i.test(u.split('?')[0]) &&
    !BLOCKED_EXT.test(u) &&
    !u.includes('/fstrz/') &&
    !u.includes('placeholder') &&
    !u.includes('logo') &&
    u.length > 30
  );
}

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

    const productRes = await fetch(productUrl, { headers, signal: AbortSignal.timeout(10000) });
    if (!productRes.ok) return null;
    const productHtml = await productRes.text();

    const candidates = extractImageUrls(productHtml, 'https://www.agrizone.net');
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

    // Étape 1 : Agrizone scraping + LLM info en parallèle
    const [agrizoneResult, enrichmentResult] = await Promise.all([
      fetchAgrizoneImage(product.reference),
      base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Tu es un expert en recherche de produits industriels et agricoles.
Recherche sur internet ce produit et retourne les informations demandées.
- Référence: ${product.reference}
- Libellé produit: ${product.intitule_origine || 'non fourni'}

IMPORTANT pour photo_url : Fais une recherche Google Images avec la requête "${searchQuery}" et retourne l'URL DIRECTE de la première image de produit trouvée.
L'URL doit :
- Pointer directement vers un fichier image (.jpg, .jpeg, .png, .webp)
- Être accessible publiquement (pas de redirection, pas de page web)
- Se terminer par .jpg, .jpeg, .png ou .webp
- EXCLURE les formats .avif, .svg, .pdf

Exemples d'URLs valides :
- https://www.mecaservicesshop.fr/428541-large_default/humidimetre-wile.jpg
- https://cdn.example.com/images/produit-reference.jpg

Cherche sur : Google Images, agrizone.net, mecaservicesshop.fr, sites fabricants officiels.

Fournis :
- designation: Désignation commerciale complète en français
- petit_descriptif: Description courte (2-3 phrases) pour catalogue professionnel
- photo_url: URL directe image (.jpg/.png/.webp) — la première image trouvée sur Google Images ou site distributeur
- marque: Marque identifiée
- categorie: Catégorie produit précise
- source_info: URL de la page produit
- source_image: Nom du site source de l'image
- niveau_confiance: "Élevé" si ref exacte, "Moyen" si bonne correspondance, "Faible" sinon
- statut_validation: "Validé" si photo+infos OK, "Validé partiel" si infos sans photo, "À vérifier" si doute, "Introuvable" si rien
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

    // Étape 2 : Sélection de la meilleure image validée
    // Priorité : Agrizone (scrapée) > LLM (validée) > LLM (non validée, fallback)
    let finalPhotoUrl = '';
    let finalSourceImage = '';

    if (agrizoneResult) {
      finalPhotoUrl = agrizoneResult.url;
      finalSourceImage = 'agrizone.net';
    } else if (enrichmentResult.photo_url) {
      const isValid = await validateImageUrl(enrichmentResult.photo_url);
      if (isValid) {
        finalPhotoUrl = enrichmentResult.photo_url;
        finalSourceImage = enrichmentResult.source_image || '';
      } else {
        // Fallback : garde l'URL même non validée (peut fonctionner côté navigateur)
        finalPhotoUrl = enrichmentResult.photo_url;
        finalSourceImage = enrichmentResult.source_image || '';
      }
    }

    const llmComment = enrichmentResult.commentaire || '';
    const finalComment = llmComment;

    const updateData = {
      designation: enrichmentResult.designation || '',
      petit_descriptif: enrichmentResult.petit_descriptif || '',
      photo_url: finalPhotoUrl,
      marque: enrichmentResult.marque || '',
      categorie: enrichmentResult.categorie || '',
      source_info: enrichmentResult.source_info || '',
      source_image: finalSourceImage,
      niveau_confiance: enrichmentResult.niveau_confiance || 'Faible',
      statut_validation: enrichmentResult.statut_validation || 'À vérifier',
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