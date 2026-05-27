import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SUPPORTED_IMG_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const BLOCKED_EXT = /\.(avif|pdf|svg|tiff|bmp|ico|gif)(\?.*)?$/i;

async function validateImageUrl(url, preferCutout = false) {
  if (!url || typeof url !== 'string') return { valid: false, cutout: false };
  if (BLOCKED_EXT.test(url.split('?')[0])) return { valid: false, cutout: false };
  if (url.includes('/fstrz/') || url.includes('/r/s/c/')) return { valid: false, cutout: false };
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Range': 'bytes=0-2047'
      },
      signal: AbortSignal.timeout(7000)
    });
    if (!res.ok) return { valid: false, cutout: false };
    const contentType = (res.headers.get('content-type') || '').split(';')[0].trim();
    await res.body?.cancel();
    if (!SUPPORTED_IMG_MIME.includes(contentType)) return { valid: false, cutout: false };
    // PNG = probablement détouré (fond transparent)
    const isCutout = contentType === 'image/png' || url.toLowerCase().includes('.png');
    return { valid: true, cutout: isCutout };
  } catch {
    return { valid: false, cutout: false };
  }
}

// Génère des variantes de référence pour améliorer la recherche
function generateRefVariants(reference) {
  const variants = new Set([reference]);
  // Enlève suffixes courants (lettres finales, codes pays, etc.)
  variants.add(reference.replace(/[A-Z]{1,3}$/, ''));
  variants.add(reference.replace(/[-_][A-Z0-9]+$/, ''));
  variants.add(reference.replace(/[^A-Z0-9]/gi, ''));
  // Sépare les blocs alphanumériques
  const parts = reference.match(/[A-Za-z]+|[0-9]+/g) || [];
  if (parts.length >= 2) {
    variants.add(parts.join(' '));
    variants.add(parts.slice(0, -1).join('')); // sans dernier bloc
    variants.add(parts.slice(1).join(''));     // sans premier bloc
  }
  return [...variants].filter(v => v && v.length >= 3);
}

// Recherche d'images via DuckDuckGo — supporte plusieurs requêtes
async function fetchDuckDuckGoImages(queries) {
  const allUrls = [];
  for (const query of queries.slice(0, 3)) {
    try {
      const tokenRes = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(8000)
      });
      if (!tokenRes.ok) continue;
      const tokenHtml = await tokenRes.text();
      const vqdMatch = tokenHtml.match(/vqd=["']?([\d-]+)["']?/);
      if (!vqdMatch) continue;
      const vqd = vqdMatch[1];

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
      if (!imgRes.ok) continue;
      const data = await imgRes.json();
      const urls = (data?.results || []).slice(0, 12).map(r => r.image).filter(Boolean);
      allUrls.push(...urls);
      if (allUrls.length >= 20) break;
    } catch {
      continue;
    }
  }
  return [...new Set(allUrls)];
}

// Sélectionne la meilleure image parmi une liste (préfère PNG/détouré)
async function selectBestImage(urls, maxTest = 12) {
  const toTest = urls.slice(0, maxTest);
  const results = await Promise.all(toTest.map(async (u) => {
    const r = await validateImageUrl(u);
    return { url: u, ...r };
  }));

  // 1. Préférer les PNG valides (détourés)
  const cutouts = results.filter(r => r.valid && r.cutout);
  if (cutouts.length > 0) return { url: cutouts[0].url, cutout: true };

  // 2. Sinon, première image valide
  const anyValid = results.find(r => r.valid);
  if (anyValid) return { url: anyValid.url, cutout: false };

  return null;
}

// Scrape un site officiel connu pour récupérer une image produit de qualité
async function fetchOfficialSiteImage(marque, reference, sourceUrl) {
  if (!sourceUrl) return null;
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'fr-FR,fr;q=0.9'
    };
    const res = await fetch(sourceUrl, { headers, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const html = await res.text();

    // Cherche og:image en priorité
    const ogMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)
                 || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i);
    if (ogMatch) {
      const r = await validateImageUrl(ogMatch[1]);
      if (r.valid) return { url: ogMatch[1], source: sourceUrl, cutout: r.cutout };
    }

    // Cherche les images PNG produit (détourées)
    const pngMatches = [...html.matchAll(/(?:src|data-src)="(https?:\/\/[^"]+\.png(?:\?[^"]*)?)"[^>]*(?:class|alt)="[^"]*(?:produit|product|main|principal)[^"]*"/gi)];
    for (const m of pngMatches) {
      const r = await validateImageUrl(m[1]);
      if (r.valid) return { url: m[1], source: sourceUrl, cutout: true };
    }

    // Images produit génériques
    const imgMatches = [...html.matchAll(/(?:src|data-src)="(https?:\/\/[^"]+\.(?:png|jpg|jpeg|webp))"/gi)];
    for (const m of imgMatches) {
      if (m[1].includes('logo') || m[1].includes('banner') || m[1].includes('placeholder')) continue;
      const r = await validateImageUrl(m[1]);
      if (r.valid) return { url: m[1], source: sourceUrl, cutout: r.cutout };
    }
  } catch {
    return null;
  }
  return null;
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

    // ── Étape 0 : Cache — réutilise si déjà enrichi dans un autre lot ──
    if (product.reference) {
      const existing = await base44.asServiceRole.entities.Product.filter({ reference: product.reference });
      const candidates = existing.filter(p =>
        p.id !== productId &&
        p.enriched === true &&
        p.statut_validation !== 'Introuvable' &&
        p.designation
      );
      if (candidates.length > 0) {
        candidates.sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date));
        const cached = candidates[0];
        const reuseData = {
          designation: cached.designation || '',
          petit_descriptif: cached.petit_descriptif || '',
          photo_url: cached.photo_url || '',
          marque: product.marque || cached.marque || '',
          categorie: cached.categorie || '',
          source_info: cached.source_info || '',
          source_image: cached.source_image || '',
          niveau_confiance: cached.niveau_confiance || 'Moyen',
          statut_validation: cached.statut_validation || 'Validé partiel',
          commentaire: `[Réutilisé] ${cached.commentaire || ''}`.trim(),
          enriched: true
        };
        await base44.entities.Product.update(productId, reuseData);
        const batchProducts = await base44.entities.Product.filter({ batch_id: product.batch_id });
        const enrichedCount = batchProducts.filter(p => p.enriched || p.id === productId).length;
        const batchArr = await base44.entities.CatalogBatch.filter({ id: product.batch_id });
        await base44.entities.CatalogBatch.update(product.batch_id, {
          processed_products: enrichedCount,
          credits_used: batchArr[0]?.credits_used || 0,
          status: enrichedCount >= batchProducts.length ? 'termine' : 'en_cours'
        });
        return Response.json({ success: true, reused: true, product: { ...product, ...reuseData } });
      }
    }

    // ── Étape 1 : LLM enrichissement (claude_sonnet pour meilleure précision) ──
    const refVariants = generateRefVariants(product.reference);
    const searchQuery = [product.marque, product.reference, product.intitule_origine].filter(Boolean).join(' ');
    const searchQueryCutout = `${searchQuery} fond blanc détouré PNG produit officiel`;

    // Lancement en parallèle : LLM + images DDG (requête normale + requête fond blanc)
    const [enrichmentResult, ddgImageUrls] = await Promise.all([
      base44.asServiceRole.integrations.Core.InvokeLLM({
        model: 'gemini_3_1_pro',
        prompt: `Tu es un expert en identification et recherche de produits commerciaux.
Recherche ce produit sur internet avec précision maximale.

Produit à identifier :
- Référence : ${product.reference}
- Libellé d'origine : ${product.intitule_origine || 'non fourni'}
- Marque : ${product.marque || 'inconnue — à identifier'}
${refVariants.length > 1 ? `- Variantes de référence à tester : ${refVariants.slice(1, 4).join(', ')}` : ''}

INSTRUCTIONS :
1. Cherche la référence exacte sur le site officiel de la marque ET sur les sites distributeurs
2. Si la référence exacte n'est pas trouvée, essaie les variantes listées (sans suffixe pays, sans tiret, etc.)
3. Pour photo_url : trouve de préférence une image officielle PNG sur fond blanc/transparent (image détourée) depuis le site fabricant. Sinon toute image produit de qualité.
4. Fournis l'URL exacte et vérifiable de l'image produit

Retourne :
- designation : désignation commerciale complète et précise en français
- petit_descriptif : description courte (2-3 phrases) orientée catalogue professionnel, avec caractéristiques techniques clés
- photo_url : URL directe de l'image produit (PNG fond blanc/transparent préféré, sinon JPG officiel)
- marque : marque exacte
- categorie : catégorie précise
- source_info : URL de la page produit trouvée
- source_image : domaine source de l'image
- niveau_confiance : "Élevé" si référence exacte trouvée, "Moyen" si variante, "Faible" sinon
- statut_validation : "Validé" si complet, "Validé partiel" si partiel, "À vérifier" si doute, "Introuvable" si rien
- commentaire : variante utilisée si applicable, remarques`,
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
      }),
      // Deux requêtes DDG en parallèle : normale + spécifique fond blanc
      fetchDuckDuckGoImages([searchQuery, searchQueryCutout, ...refVariants.slice(0, 2).map(v => `${product.marque || ''} ${v}`.trim())])
    ]);

    // ── Étape 2 : Sélection de la meilleure image ──
    let finalPhotoUrl = '';
    let finalSourceImage = '';
    let isPhotoCutout = false;

    // 2a. URL proposée par le LLM — la valider en priorité
    if (enrichmentResult.photo_url) {
      const r = await validateImageUrl(enrichmentResult.photo_url);
      if (r.valid) {
        finalPhotoUrl = enrichmentResult.photo_url;
        finalSourceImage = enrichmentResult.source_image || (() => { try { return new URL(enrichmentResult.photo_url).hostname.replace('www.', ''); } catch { return ''; } })();
        isPhotoCutout = r.cutout;
      }
    }

    // 2b. Si l'image LLM n'est pas détourée, tenter de récupérer une meilleure image sur le site source
    if (finalPhotoUrl && !isPhotoCutout && enrichmentResult.source_info) {
      const siteImg = await fetchOfficialSiteImage(enrichmentResult.marque, product.reference, enrichmentResult.source_info);
      if (siteImg && siteImg.cutout) {
        finalPhotoUrl = siteImg.url;
        finalSourceImage = siteImg.source;
        isPhotoCutout = true;
      }
    }

    // 2c. Pas d'image LLM valide → chercher via DuckDuckGo
    if (!finalPhotoUrl && ddgImageUrls.length > 0) {
      const best = await selectBestImage(ddgImageUrls, 15);
      if (best) {
        finalPhotoUrl = best.url;
        isPhotoCutout = best.cutout;
        try { finalSourceImage = new URL(best.url).hostname.replace('www.', ''); } catch { finalSourceImage = 'duckduckgo'; }
      }
    }

    // 2d. Fallback : scrape site officiel depuis source_info
    if (!finalPhotoUrl && enrichmentResult.source_info) {
      const siteImg = await fetchOfficialSiteImage(enrichmentResult.marque, product.reference, enrichmentResult.source_info);
      if (siteImg) {
        finalPhotoUrl = siteImg.url;
        finalSourceImage = siteImg.source;
        isPhotoCutout = siteImg.cutout;
      }
    }

    const updateData = {
      designation: enrichmentResult.designation || '',
      petit_descriptif: enrichmentResult.petit_descriptif || '',
      photo_url: finalPhotoUrl,
      marque: enrichmentResult.marque || product.marque || '',
      categorie: enrichmentResult.categorie || '',
      source_info: enrichmentResult.source_info || '',
      source_image: finalSourceImage + (isPhotoCutout ? ' (détouré)' : ''),
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
    const batchArr = await base44.entities.CatalogBatch.filter({ id: product.batch_id });
    await base44.entities.CatalogBatch.update(product.batch_id, {
      processed_products: enrichedCount,
      credits_used: (batchArr[0]?.credits_used || 0) + 1,
      status: enrichedCount >= batchProducts.length ? 'termine' : 'en_cours'
    });

    return Response.json({ success: true, product: { ...product, ...updateData } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});