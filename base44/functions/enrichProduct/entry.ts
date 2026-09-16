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

// Normalise une chaîne pour comparaison (marque, etc.)
function normalizeStr(s) {
  return (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function hostnameOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

// Score un candidat image selon la présence de la référence / marque dans l'URL
function scoreImageUrl(url, ctx) {
  const u = (url || '').toLowerCase();
  let score = 0;
  const ref = (ctx.reference || '').toLowerCase();
  if (ref && ref.length >= 4 && u.includes(ref)) score += 6;
  for (const v of ctx.refVariants || []) {
    const vv = (v || '').toLowerCase();
    if (vv.length >= 4 && vv !== ref && u.includes(vv)) { score += 3; break; }
  }
  const marqueWords = normalizeStr(ctx.marque).split(' ').filter(w => w.length >= 3);
  for (const w of marqueWords) {
    if (u.includes(w)) { score += 2; break; }
  }
  return score;
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

// Classe les images valides d'une liste par pertinence (score réf/marque, puis détourage)
async function rankValidImages(urls, ctx, maxTest = 15) {
  const toTest = [...new Set(urls)].slice(0, maxTest);
  const results = await Promise.all(toTest.map(async (u) => {
    const r = await validateImageUrl(u);
    return { url: u, valid: r.valid, cutout: r.cutout, score: scoreImageUrl(u, ctx) };
  }));
  return results
    .filter(r => r.valid)
    .sort((a, b) => (b.score - a.score) || (Number(b.cutout) - Number(a.cutout)));
}

// ── Vérification visuelle (garde-fou anti hors-sujet) ──
// Renvoie { matches: true|false|null } ; null = vérification impossible (on ne rejette pas).
// NB : nécessite que Core.InvokeLLM accepte l'entrée image via `file_urls` (multimodal).
async function verifyImageMatch(llm, imageUrl, product, enrichmentResult) {
  if (!imageUrl) return { matches: false, reason: 'URL vide' };
  try {
    const res = await llm.InvokeLLM({
      model: 'gemini_3_1_pro',
      file_urls: [imageUrl],
      prompt: `Tu es un contrôleur qualité de catalogue produit.
Observe UNIQUEMENT l'image fournie et dis si elle représente bien ce produit :

- Désignation : ${enrichmentResult.designation || product.intitule_origine || 'inconnue'}
- Référence : ${product.reference}
- Marque : ${enrichmentResult.marque || product.marque || 'inconnue'}
- Catégorie : ${enrichmentResult.categorie || 'inconnue'}
- Libellé d'origine : ${product.intitule_origine || 'non fourni'}

Réponds "true" pour matches SEULEMENT si l'objet visible sur l'image correspond au TYPE de produit décrit
(même famille : ex. pièce agricole, disque, pointe de soc, dent de semoir…).
Réponds "false" si l'image montre un objet sans rapport (ex. bouteille, logo, bannière, produit d'une autre famille),
une image générique/placeholder, ou si tu as un doute sérieux.`,
      response_json_schema: {
        type: 'object',
        properties: {
          matches: { type: 'boolean' },
          confidence: { type: 'string', enum: ['Élevé', 'Moyen', 'Faible'] },
          reason: { type: 'string' }
        },
        required: ['matches']
      }
    });
    return {
      matches: res?.matches === true,
      confidence: res?.confidence || 'Moyen',
      reason: res?.reason || ''
    };
  } catch {
    // Vérification indisponible → on ne bloque pas (fail-safe)
    return { matches: null, reason: 'Vérification visuelle indisponible' };
  }
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
    // Réutilisation UNIQUEMENT si la marque correspond, pour éviter les collisions
    // de références entre fabricants différents (ex : même n° chez deux marques).
    if (product.reference && product.marque) {
      const productMarque = normalizeStr(product.marque);
      const existing = await base44.asServiceRole.entities.Product.filter({ reference: product.reference });
      const candidates = existing.filter(p =>
        p.id !== productId &&
        p.enriched === true &&
        p.statut_validation !== 'Introuvable' &&
        p.designation &&
        p.marque && normalizeStr(p.marque) === productMarque
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
    // Requêtes ciblées marque + référence (exacte puis variantes), sans mots parasites
    const searchQuery = [product.marque, product.reference, product.intitule_origine].filter(Boolean).join(' ');
    const ddgQueries = [
      [product.marque, product.reference].filter(Boolean).join(' '),
      [product.marque, product.intitule_origine].filter(Boolean).join(' '),
      ...refVariants.slice(0, 2).map(v => [product.marque, v].filter(Boolean).join(' '))
    ].filter(q => q && q.trim().length >= 3);

    // Lancement en parallèle : LLM + images DDG
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
      // Requêtes DDG ciblées marque + référence
      fetchDuckDuckGoImages(ddgQueries)
    ]);

    // ── Étape 2 : Constitution d'une liste de candidats images classés ──
    const imgCtx = { reference: product.reference, refVariants, marque: enrichmentResult.marque || product.marque };
    const candidates = []; // { url, cutout, source }
    const seen = new Set();
    const pushCandidate = (url, cutout, source) => {
      if (!url || seen.has(url)) return;
      seen.add(url);
      candidates.push({ url, cutout: !!cutout, source: source || hostnameOf(url) });
    };

    // 2a. URL proposée par le LLM (priorité — issue de la page produit)
    if (enrichmentResult.photo_url) {
      const r = await validateImageUrl(enrichmentResult.photo_url);
      if (r.valid) pushCandidate(enrichmentResult.photo_url, r.cutout, enrichmentResult.source_image || hostnameOf(enrichmentResult.photo_url));
    }

    // 2b. Image du site officiel (souvent détourée et fiable)
    if (enrichmentResult.source_info) {
      const siteImg = await fetchOfficialSiteImage(enrichmentResult.marque, product.reference, enrichmentResult.source_info);
      if (siteImg) pushCandidate(siteImg.url, siteImg.cutout, siteImg.source);
    }

    // 2c. Résultats DuckDuckGo classés par pertinence (réf/marque dans l'URL, puis détourage)
    const rankedDdg = await rankValidImages(ddgImageUrls, imgCtx, 15);
    for (const c of rankedDdg) pushCandidate(c.url, c.cutout, hostnameOf(c.url) || 'duckduckgo');

    // ── Étape 3 : Vérification visuelle — on garde le 1er candidat confirmé ──
    let finalPhotoUrl = '';
    let finalSourceImage = '';
    let isPhotoCutout = false;
    let imageVerified = null;   // true confirmé / null non vérifié / false tous rejetés
    let imageComment = '';

    const MAX_VERIFY = 4;
    let sawDefiniteNo = false;
    let sawError = false;
    let checkedCount = 0;

    for (const c of candidates) {
      if (checkedCount >= MAX_VERIFY) break;
      checkedCount++;
      const v = await verifyImageMatch(base44.asServiceRole.integrations.Core, c.url, product, enrichmentResult);
      if (v.matches === true) {
        finalPhotoUrl = c.url; finalSourceImage = c.source; isPhotoCutout = c.cutout;
        imageVerified = true;
        break;
      }
      if (v.matches === false) sawDefiniteNo = true;
      if (v.matches === null) sawError = true;
    }

    // Fail-safe : si la vérification visuelle est indisponible (aucune réponse fiable),
    // on ne prive pas le produit d'image → on garde le meilleur candidat, mais on le signale.
    if (!finalPhotoUrl && sawError && !sawDefiniteNo && candidates.length > 0) {
      const c = candidates[0];
      finalPhotoUrl = c.url; finalSourceImage = c.source; isPhotoCutout = c.cutout;
      imageVerified = null;
      imageComment = 'Image non vérifiée (contrôle visuel indisponible), à valider manuellement.';
    } else if (!finalPhotoUrl && candidates.length > 0) {
      // Des images ont été trouvées mais rejetées comme non conformes → mieux vaut pas d'image que fausse
      imageVerified = false;
      imageComment = `${candidates.length} image(s) trouvée(s) mais rejetée(s) car non conformes au produit.`;
    }

    // Confiance : plafonnée à "Faible" si l'image n'a pas pu être confirmée visuellement
    let niveauConfiance = enrichmentResult.niveau_confiance || 'Faible';
    if (finalPhotoUrl && imageVerified !== true) niveauConfiance = 'Faible';

    // Statut : sans image confirmée, on force au moins "À vérifier" pour attirer l'œil
    let statutValidation;
    if (finalPhotoUrl && imageVerified === true) {
      statutValidation = enrichmentResult.statut_validation || 'Validé partiel';
    } else if (finalPhotoUrl) {
      statutValidation = 'À vérifier';
    } else {
      statutValidation = (enrichmentResult.statut_validation === 'Validé')
        ? 'Validé partiel'
        : (enrichmentResult.statut_validation || 'À vérifier');
    }

    const commentaire = [enrichmentResult.commentaire || '', imageComment].filter(Boolean).join(' — ').trim();

    const suffixeSource = isPhotoCutout ? ' (détouré)' : '';
    const suffixeVerif = imageVerified === true ? ' ✓ vérifié' : '';

    const updateData = {
      designation: enrichmentResult.designation || '',
      petit_descriptif: enrichmentResult.petit_descriptif || '',
      photo_url: finalPhotoUrl,
      marque: enrichmentResult.marque || product.marque || '',
      categorie: enrichmentResult.categorie || '',
      source_info: enrichmentResult.source_info || '',
      source_image: finalPhotoUrl ? (finalSourceImage + suffixeSource + suffixeVerif) : '',
      niveau_confiance: niveauConfiance,
      statut_validation: statutValidation,
      commentaire,
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