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

    const searchQuery = product.intitule_origine
      ? `${product.reference} ${product.intitule_origine}`
      : product.reference;

    const enrichmentResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Tu es un expert en recherche de produits industriels et professionnels. 
Recherche sur internet les informations sur ce produit:
- Référence: ${product.reference}
- Libellé produit fourni: ${product.intitule_origine || 'non fourni'}
- Requête de recherche: "${searchQuery}"

IMPORTANT: Si un libellé produit est fourni, utilise-le comme contexte prioritaire pour identifier le produit. La référence seule peut être ambiguë, mais combinée au libellé elle permet une identification précise.

Tu DOIS rechercher ce produit sur internet et fournir des informations RÉELLES et VÉRIFIÉES.
Ne JAMAIS inventer de données techniques non confirmées par une source.

PRIORITÉ ABSOLUE : Trouve une URL d'image directe et fonctionnelle du produit.
Pour trouver la photo :
1. Cherche la référence sur les sites fabricants (makita.fr, bosch.fr, etc.) et distributeurs (rs-components.com, manomano.fr, leroymerlin.fr, amazon.fr, etc.)
2. L'URL photo_url doit pointer directement vers un fichier image (.jpg, .jpeg, .png, .webp) — pas une page web
3. Préfère les images des sites fabricants officiels ou des grands distributeurs connus
4. Si tu trouves plusieurs images, choisis celle de la meilleure qualité depuis la source la plus fiable
5. Ne mets JAMAIS une URL de page web, seulement une URL d'image directe

Fournis les informations suivantes:
- designation: Désignation commerciale propre et complète en français
- petit_descriptif: Description courte commerciale en français (2-3 phrases max), utile pour un catalogue
- photo_url: URL DIRECTE vers le fichier image du produit (.jpg/.png/.webp) — OBLIGATOIRE, cherche sur plusieurs sources
- marque: Marque du produit si identifiable avec confiance
- categorie: Catégorie produit (outillage, équipement, consommable, etc.)
- source_info: URL de la page produit source principale
- source_image: URL du site depuis lequel vient l'image
- niveau_confiance: "Élevé" si correspondance exacte par référence, "Moyen" si bonne correspondance mais pas certaine, "Faible" si peu de résultats
- statut_validation: "Validé" si photo + infos trouvées, "Validé partiel" si infos OK mais pas de photo, "À vérifier" si doute, "Introuvable" si rien de fiable
- commentaire: Tout commentaire utile, notamment si la photo n'a pas pu être trouvée

Si tu ne trouves pas de photo directe, indique-le dans le commentaire et mets statut_validation à "Validé partiel" même si les autres infos sont bonnes.
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