import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });

    const { productId } = await req.json();
    if (!productId) {
      return Response.json({ error: 'productId requis' }, { status: 400 });
    }

    const products = await base44.entities.Product.filter({ id: productId });
    if (!products || products.length === 0) {
      return Response.json({ error: 'Produit non trouvé' }, { status: 404 });
    }
    const product = products[0];

    const searchQuery = `${product.reference} ${product.intitule_origine || ''}`.trim();

    const enrichmentResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Tu es un expert en recherche de produits industriels et professionnels. 
Recherche sur internet les informations sur ce produit:
- Référence: ${product.reference}
- Intitulé d'origine: ${product.intitule_origine || 'non fourni'}
- Recherche: "${searchQuery}"

Tu DOIS rechercher ce produit sur internet et fournir des informations RÉELLES et VÉRIFIÉES.
Ne JAMAIS inventer de données techniques non confirmées par une source.

Fournis les informations suivantes:
- designation: Désignation commerciale propre et complète en français
- petit_descriptif: Description courte commerciale en français (2-3 phrases max), utile pour un catalogue
- photo_url: URL directe d'une image réelle du produit (pas un placeholder)
- marque: Marque du produit si identifiable avec confiance
- categorie: Catégorie produit (outillage, équipement, consommable, etc.)
- source_info: URL de la source principale d'information
- source_image: URL du site source de l'image
- niveau_confiance: "Élevé" si correspondance exacte par référence, "Moyen" si bonne correspondance mais pas certaine, "Faible" si peu de résultats
- statut_validation: "Validé" si toutes les infos sont trouvées et fiables, "Validé partiel" si certaines infos manquent, "À vérifier" si doute sur la correspondance, "Introuvable" si rien de fiable trouvé
- commentaire: Tout commentaire utile sur la recherche

Si tu ne trouves rien de fiable, mets statut_validation à "Introuvable" et niveau_confiance à "Faible".`,
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

    // Preserve existing price comments
    let finalComment = product.commentaire || '';
    if (enrichmentResult.commentaire) {
      finalComment = finalComment ? `${finalComment} | ${enrichmentResult.commentaire}` : enrichmentResult.commentaire;
    }

    const updateData = {
      designation: enrichmentResult.designation || '',
      petit_descriptif: enrichmentResult.petit_descriptif || '',
      photo_url: enrichmentResult.photo_url || '',
      marque: enrichmentResult.marque || '',
      categorie: enrichmentResult.categorie || '',
      source_info: enrichmentResult.source_info || '',
      source_image: enrichmentResult.source_image || '',
      niveau_confiance: enrichmentResult.niveau_confiance || 'Faible',
      statut_validation: enrichmentResult.statut_validation || 'À vérifier',
      commentaire: finalComment,
      enriched: true
    };

    await base44.entities.Product.update(productId, updateData);

    // Update batch progress
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