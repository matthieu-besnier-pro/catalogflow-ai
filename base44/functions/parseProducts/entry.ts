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

    for (const line of lines) {
      // Pattern: REFERENCE intitulé PRIX€ HT [Prix barré PRIX€ ht]
      // Reference is typically the first word (alphanumeric)
      const refMatch = line.match(/^([A-Za-z0-9]+)/);
      const reference = refMatch ? refMatch[1] : '';

      // Extract prices - number directly followed by € (no space between number and €)
      const priceMatches = [...line.matchAll(/(\d+[\.,]?\d*)€/gi)];
      
      let tarifPromoHt = null;
      let tarifNormalHt = null;

      // Check if there's a "prix barré" pattern first
      const prixBarreMatch = line.match(/prix\s+barr[eé]\s+(\d+[\.,]?\d*)€/i);
      
      if (priceMatches.length >= 1) {
        tarifPromoHt = parseFloat(priceMatches[0][1].replace(',', '.'));
      }
      
      if (prixBarreMatch) {
        tarifNormalHt = parseFloat(prixBarreMatch[1].replace(',', '.'));
      } else if (priceMatches.length >= 2) {
        tarifNormalHt = parseFloat(priceMatches[1][1].replace(',', '.'));
      }

      // Extract intitulé: text between reference and first price (number€)
      let intitule = '';
      if (reference) {
        const afterRef = line.substring(reference.length).trim();
        const priceIdx = afterRef.search(/\d+[\.,]?\d*€/i);
        if (priceIdx > 0) {
          intitule = afterRef.substring(0, priceIdx).trim();
        } else {
          intitule = afterRef;
        }
      }

      // Handle " (ditto marks) for intitulé
      if (intitule === '"' || intitule === '"' || intitule === '«') {
        intitule = '';
      }

      // Price coherence check
      let commentaire = '';
      if (tarifNormalHt !== null && tarifPromoHt !== null) {
        if (tarifNormalHt < tarifPromoHt) {
          commentaire = 'Prix barré inférieur au prix promo - à vérifier';
        }
      } else if (tarifNormalHt === null && prixBarreMatch === null) {
        commentaire = 'Prix normal non fourni';
      }

      products.push({
        batch_id: batchId,
        reference,
        intitule_origine: intitule || '',
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