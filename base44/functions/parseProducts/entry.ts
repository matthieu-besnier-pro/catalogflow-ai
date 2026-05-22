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

    // Extrait les prix (avec ou sans €, virgule ou point décimal)
    // Retourne { promo, normal } avec promo <= normal
    const parsePriceStr = (s) => {
      if (!s) return null;
      const cleaned = s.replace(/\s/g, '').replace(/[^\d.,]/g, '').replace(',', '.');
      const val = parseFloat(cleaned);
      return isNaN(val) ? null : val;
    };

    const extractPrices = (cols) => {
      // Cherche les colonnes qui sont des prix (numériques, éventuellement avec €)
      const pricePattern = /^[\d\s]+[.,]?\d*\s*€?$/;
      const priceCols = [];
      const textCols = [];
      for (const col of cols) {
        if (pricePattern.test(col.replace(/\s/g, '').replace('€', '')) && parsePriceStr(col) !== null) {
          priceCols.push(parsePriceStr(col));
        } else {
          textCols.push(col);
        }
      }
      return { priceCols, textCols };
    };

    // Détecte le format : tabulé (tabs ou 2+ espaces) OU inline avec €
    const isTabular = lines.some(l => l.includes('\t') || /\s{3,}/.test(l));

    for (const line of lines) {
      let reference = '';
      let intitule = '';
      let description = '';
      let marque = '';
      let tarifNormalHt = null;
      let tarifPromoHt = null;
      let commentaire = '';

      if (isTabular) {
        // Split sur tabulations ou séquences de 2+ espaces
        const cols = line.split(/\t|  +/).map(c => c.trim()).filter(c => c.length > 0);

        // Cherche d'abord les prix inline avec € dans chaque colonne
        const priceInlineCols = [];
        const otherCols = [];
        for (const col of cols) {
          // Colonne prix : contient un nombre suivi de € (ex: "29,90 €", "1 040,00 €")
          const inlinePrice = col.match(/^([\d\s]+[.,]?\d*)\s*€\s*$/);
          if (inlinePrice) {
            priceInlineCols.push(parsePriceStr(inlinePrice[1]));
          } else {
            otherCols.push(col);
          }
        }

        // Si pas de prix avec €, essaie colonnes purement numériques (fin de ligne)
        let finalPriceCols = priceInlineCols;
        let textCols = otherCols;
        if (finalPriceCols.length === 0) {
          const tail = [];
          let i = cols.length - 1;
          while (i >= 0 && parsePriceStr(cols[i]) !== null && /^[\d\s.,]+$/.test(cols[i])) {
            tail.unshift(parsePriceStr(cols[i]));
            i--;
          }
          finalPriceCols = tail;
          textCols = cols.slice(0, cols.length - tail.length);
        }

        // Attribution des prix
        if (finalPriceCols.length >= 2) {
          const a = finalPriceCols[finalPriceCols.length - 2];
          const b = finalPriceCols[finalPriceCols.length - 1];
          tarifNormalHt = Math.max(a, b);
          tarifPromoHt = Math.min(a, b);
        } else if (finalPriceCols.length === 1) {
          tarifPromoHt = finalPriceCols[0];
          commentaire = 'Prix normal non fourni';
        } else {
          commentaire = 'Prix non détectés';
        }

        // Attribution des colonnes texte
        // Format possible : REF | DESIGNATION | DESCRIPTION | MARQUE
        //                   REF | DESIGNATION | DESCRIPTION
        //                   REF | DESIGNATION | MARQUE
        //                   REF | DESIGNATION
        reference = textCols[0] || '';
        if (textCols.length >= 4) {
          intitule = textCols[1];
          description = textCols.slice(2, -1).join(' ');
          marque = textCols[textCols.length - 1];
        } else if (textCols.length === 3) {
          intitule = textCols[1];
          description = textCols[2];
        } else if (textCols.length === 2) {
          intitule = textCols[1];
        }

      } else {
        // Format inline : REF  Désignation  Prix€
        const refMatch = line.match(/^([A-Za-z0-9]+)/);
        reference = refMatch ? refMatch[1] : '';

        // Cherche prix avec € (supporte "1 040,00 €" avec espaces)
        const priceMatches = [...line.matchAll(/([\d\s]+[.,]?\d*)\s*€/gi)];
        const prixBarreMatch = line.match(/prix\s+barr[eé]\s+([\d\s]+[.,]?\d*)\s*€/i);

        if (priceMatches.length >= 1) {
          tarifPromoHt = parsePriceStr(priceMatches[0][1]);
        }
        if (prixBarreMatch) {
          tarifNormalHt = parsePriceStr(prixBarreMatch[1]);
        } else if (priceMatches.length >= 2) {
          tarifNormalHt = parsePriceStr(priceMatches[1][1]);
        }
        if (tarifPromoHt !== null && tarifNormalHt !== null) {
          const lower = Math.min(tarifPromoHt, tarifNormalHt);
          const higher = Math.max(tarifPromoHt, tarifNormalHt);
          tarifPromoHt = lower;
          tarifNormalHt = higher;
        }

        if (reference) {
          const afterRef = line.substring(reference.length).trim();
          const priceIdx = afterRef.search(/([\d\s]+[.,]?\d*)\s*€/i);
          const allText = priceIdx > 0 ? afterRef.substring(0, priceIdx).trim() : afterRef;
          // Découpe le texte en segments par tab ou 2+ espaces pour séparer désignation et description
          const segments = allText.split(/\t|  +/).map(s => s.trim()).filter(Boolean);
          intitule = segments[0] || allText;
          description = segments.slice(1).join(' ');
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
        petit_descriptif: description || '',
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