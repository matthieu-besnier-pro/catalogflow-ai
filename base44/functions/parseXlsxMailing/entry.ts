import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Parse le format XLSX MAILINGRDV :
// PAGE X sur plusieurs sections, colonnes : N° | REFERENCE | DESIGNATION | PRIX € HT | COMMENTAIRE
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });

    const { rows, batchId } = await req.json();
    // rows = tableau d'objets { numero, reference, designation, prix, commentaire }

    if (!rows || !batchId) {
      return Response.json({ error: 'rows et batchId requis' }, { status: 400 });
    }

    const products = [];

    const toNum = (v) => {
      if (v === null || v === undefined || v === '') return null;
      const p = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
      return isNaN(p) ? null : p;
    };

    for (const row of rows) {
      const ref = String(row.reference || '').trim();
      if (!ref || ref.toLowerCase() === 'reference') continue;

      // Prix HT (principal) et TTC. Rétro-compat : `prix` = HT si prix_ht absent.
      const prixHt = toNum(row.prix_ht ?? row.prix);
      const prixTtc = toNum(row.prix_ttc);

      const commentaire = String(row.commentaire || '').trim();
      const designation = String(row.designation || '').trim();

      products.push({
        batch_id: batchId,
        reference: ref,
        intitule_origine: designation,
        petit_descriptif: '',
        marque: '',
        tarif_promo_ht: prixHt,   // prix principal (HT), suit la convention de l'app
        tarif_normal_ht: null,
        tarif_ttc: prixTtc,       // prix TTC importé (affichage "TTC en gros" à venir)
        commentaire: commentaire || (prixHt === null ? 'Prix non fourni' : ''),
        statut_validation: 'À vérifier',
        enriched: false
      });
    }

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