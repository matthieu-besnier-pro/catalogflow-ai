import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });

    const { rawText, batchId } = await req.json();
    if (!rawText || !batchId) {
      return Response.json({ error: 'Texte brut et batchId requis' }, { status: 400 });
    }

    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const products = [];

    // Détecte si la ligne est en format tabulé (colonnes séparées par tab ou plusieurs espaces)
    // Format tabulé : REF \t INTITULE \t MARQUE \t PRIX_NORMAL \t PRIX_PROMO
    //              ou : REF \t INTITULE \t PRIX_NORMAL \t PRIX_PROMO
    const isTabular = lines.some(l => l.includes('\t') || /\s{3,}/.test(l));

    const parsePriceStr = (s) => {
      if (!s) return null;
      const cleaned = s.replace(/[^\d.,]/g, '').replace(',', '.');
      const val = parseFloat(cleaned);
      return isNaN(val) ? null : val;
    };

    const isNumericCol = (s) => s && /^\d[\d.,\s]*$/.test(s.trim());

    for (const line of lines) {
      let reference = '';
      let intitule = '';
      let marque = '';
      let tarifNormalHt = null;
      let tarifPromoHt = null;
      let commentaire = '';

      if (isTabular) {
        // Split sur tabulations ou séquences de 2+ espaces
        const cols = line.split(/\t|  +/).map(c => c.trim()).filter(c => c.length > 0);

        // Dernières colonnes numériques = prix
        const numericTail = [];
        let i = cols.length - 1;
        while (i >= 0 && isNumericCol(cols[i]) && numericTail.length < 2) {
          numericTail.unshift(parsePriceStr(cols[i]));
          i--;
        }
        const textCols = cols.slice(0, i + 1);

        reference = textCols[0] || '';
        // Si la dernière colonne texte ressemble à une marque (tout caps, court), on la sépare
        if (textCols.length >= 3) {
          intitule = textCols.slice(1, -1).join(' ');
          marque = textCols[textCols.length - 1];
        } else if (textCols.length === 2) {
          intitule = textCols[1];
        } else {
          intitule = '';
        }

        if (numericTail.length === 2) {
          // Deux prix : le plus grand = normal (barré), le plus petit = promo
          const a = numericTail[0], b = numericTail[1];
          tarifNormalHt = Math.max(a, b);
          tarifPromoHt = Math.min(a, b);
        } else if (numericTail.length === 1) {
          tarifPromoHt = numericTail[0];
          commentaire = 'Prix normal non fourni';
        } else {
          commentaire = 'Prix non détectés';
        }

      } else {
        // Format inline avec € ou sans séparateur clair
        const refMatch = line.match(/^([A-Za-z0-9]+)/);
        reference = refMatch ? refMatch[1] : '';

        const priceMatches = [...line.matchAll(/(\d+[\.,]?\d*)€/gi)];
        const prixBarreMatch = line.match(/prix\s+barr[eé]\s+(\d+[\.,]?\d*)€/i);

        if (priceMatches.length >= 1) {
          tarifPromoHt = parseFloat(priceMatches[0][1].replace(',', '.'));
        }
        if (prixBarreMatch) {
          tarifNormalHt = parseFloat(prixBarreMatch[1].replace(',', '.'));
        } else if (priceMatches.length >= 2) {
          tarifNormalHt = parseFloat(priceMatches[1][1].replace(',', '.'));
        }
        if (tarifPromoHt !== null && tarifNormalHt !== null) {
          const lower = Math.min(tarifPromoHt, tarifNormalHt);
          const higher = Math.max(tarifPromoHt, tarifNormalHt);
          tarifPromoHt = lower;
          tarifNormalHt = higher;
        }

        if (reference) {
          const afterRef = line.substring(reference.length).trim();
          const priceIdx = afterRef.search(/\d+[\.,]?\d*€/i);
          intitule = priceIdx > 0 ? afterRef.substring(0, priceIdx).trim() : afterRef;
        }
        if (intitule === '"' || intitule === '"' || intitule === '«') intitule = '';
        if (tarifNormalHt !== null && tarifPromoHt !== null && tarifNormalHt < tarifPromoHt) {
          commentaire = 'Prix barré inférieur au prix promo - à vérifier';
        } else if (tarifNormalHt === null) {
          commentaire = 'Prix normal non fourni';
        }
      }

      products.push({
        batch_id: batchId,
        reference,
        intitule_origine: intitule || '',
        marque: marque || '',
        tarif_promo_ht: tarifPromoHt,
        tarif_normal_ht: tarifNormalHt,
        commentaire,
        statut_validation: 'À vérifier',
        enriched: false
      });
    }

    // Bulk create products
    if (products.length > 0) {
      await base44.entities.Product.bulkCreate(products);
      await base44.entities.CatalogBatch.update(batchId, {
        total_products: products.length,
        processed_products: 0
      });
    }

    return Response.json({ success: true, count: products.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});