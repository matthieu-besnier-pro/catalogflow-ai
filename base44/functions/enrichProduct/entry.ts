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

// Scrape Google Images et retourne les premières URLs d'images directes valides
async function fetchGoogleImages(query) {
  try {
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch&hl=fr&gl=fr`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate',
        'Cache-Control': 'no-cache'
      },
      signal: AbortSignal.timeout(12000)
    });
    if (!res.ok) return [];
    const html = await res.text();

    const candidates = new Set();

    // Pattern 1 : URLs dans les blocs JSON embarqués (format Google Images)
    // Google stocke les URLs d'images dans des chaînes JSON type ["https://...jpg",123,456]
    const jsonImgPattern = /\["(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)(?:\?[^"]*)?)"(?:,\d+,\d+)?\]/gi;
    let m;
    while ((m = jsonImgPattern.exec(html)) !== null) {
      candidates.add(m[1]);
    }

    // Pattern 2 : \x22https://...\x22 (encodage Google)
    const hexPattern = /\\x22(https?:\/\/[^\\]+\.(?:jpg|jpeg|png|webp)(?:\?[^\\]*)?)\\/gi;
    while ((m = hexPattern.exec(html)) !== null) {
      candidates.add(m[1]);
    }

    // Pattern 3 : URLs directes dans les attributs src/data-src
    const srcPattern = /(?:src|data-src)="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)(?:\?[^"]*)?)"/gi;
    while ((m = srcPattern.exec(html)) !== null) {
      const u = m[1];
      if (!u.includes('gstatic.com') && !u.includes('google.com')) {
        candidates.add(u);
      }
    }

    // Filtre : exclure miniatures Google (gstatic), logos, placeholders
    const filtered = [...candidates].filter(u =>
      !u.includes('gstatic.com') &&
      !u.includes('google.com') &&
      !u.includes('placeholder') &&
      !u.includes('logo') &&
      !BLOCKED_EXT.test(u.split('?')[0]) &&
      u.length > 40
    );

    return filtered.slice(0, 10); // On garde les 10 premières candidates
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

    // Trouve le premier lien produit Agrizone
    const linkMatch = searchHtml.match(/href="(https?:\/\/www\.agrizone\.net\/[^"]+\.html)"/i);
    if (!linkMatch) return null;
    const productUrl = linkMatch[1];

    const productRes = await fetch(productUrl, { headers, signal: AbortSignal.timeout(10000) });
    if (!productRes.ok) return null;
    const productHtml = await productRes.text();

    // Cherche og:image en priorité
    const ogMatch = productHtml.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)
                 || productHtml.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i);
    if (ogMatch && VALID_IMG_EXT.test(ogMatch[1].split('?')[0]) && !BLOCKED_EXT.test(ogMatch[1])) {
      const valid = await validateImageUrl(ogMatch[1]);
      if (valid) return { url: ogMatch[1], source: productUrl };
    }

    // Cherche les images produit dans le HTML
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

    // Étape 1 : Scraping Agrizone + Google Images + LLM en parallèle
    const [agrizoneResult, googleImageUrls, enrichmentResult] = await Promise.all([
      fetchAgrizoneImage(product.reference),
      fetchGoogleImages(searchQuery),
      base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Tu es un expert en produits industriels et agricoles.
Recherche ce produit sur internet et retourne ses informations commerciales.
- Référence: ${product.reference}
- Libellé: ${product.intitule_origine || 'non fourni'}

Fournis :
- designation: Désignation commerciale complète en français
- petit_descriptif: Description courte (2-3 phrases) pour catalogue professionnel
- photo_url: laisse VIDE (sera rempli automatiquement)
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
    // Priorité : Agrizone (scrapée) > Google Images (première valide) > rien
    let finalPhotoUrl = '';
    let finalSourceImage = '';

    if (agrizoneResult) {
      finalPhotoUrl = agrizoneResult.url;
      finalSourceImage = 'agrizone.net';
    } else {
      // Valide les candidates Google Images en parallèle (max 5 en même temps)
      const toTest = googleImageUrls.slice(0, 5);
      const results = await Promise.all(toTest.map(u => validateImageUrl(u).then(ok => ok ? u : null)));
      const firstValid = results.find(u => u !== null);
      if (firstValid) {
        finalPhotoUrl = firstValid;
        finalSourceImage = 'google-images';
        // Tente d'identifier le domaine source
        try {
          const domain = new URL(firstValid).hostname.replace('www.', '');
          finalSourceImage = domain;
        } catch {}
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