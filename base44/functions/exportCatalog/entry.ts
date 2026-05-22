import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { zipSync, strToU8 } from 'npm:fflate@0.8.2';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });

    const { batchId, imageNaming } = await req.json();
    if (!batchId) return Response.json({ error: 'batchId requis' }, { status: 400 });

    const [batchArr, products] = await Promise.all([
      base44.entities.CatalogBatch.filter({ id: batchId }),
      base44.entities.Product.filter({ batch_id: batchId })
    ]);
    const batch = batchArr[0];
    if (!batch) return Response.json({ error: 'Batch non trouvé' }, { status: 404 });

    // Download images in parallel (max 10 at a time)
    const imageResults = [];
    const chunkSize = 10;
    for (let i = 0; i < products.length; i += chunkSize) {
      const chunk = products.slice(i, i + chunkSize);
      const chunkResults = await Promise.all(chunk.map(async (p, idx) => {
        const globalIdx = i + idx;
        if (!p.photo_url) return { product: p, idx: globalIdx, buffer: null, ext: null };
        try {
          const res = await fetch(p.photo_url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(10000)
          });
          if (!res.ok) return { product: p, idx: globalIdx, buffer: null, ext: null };
          const ct = (res.headers.get('content-type') || '').split(';')[0].trim();
          const extMap = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
          const ext = extMap[ct] || 'jpg';
          const buffer = await res.arrayBuffer();
          return { product: p, idx: globalIdx, buffer, ext };
        } catch {
          return { product: p, idx: globalIdx, buffer: null, ext: null };
        }
      }));
      imageResults.push(...chunkResults);
    }

    // Helper: escape XML
    const xe = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const colLetter = (n) => { let s = ''; while (n > 0) { s = String.fromCharCode(65 + ((n-1) % 26)) + s; n = Math.floor((n-1) / 26); } return s; };

    const buildSheet = (dataRows, headers) => {
      let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">\n<sheetData>`;
      xml += `<row r="1">`;
      headers.forEach((h, ci) => {
        xml += `<c r="${colLetter(ci+1)}1" t="inlineStr"><is><t>${xe(h)}</t></is></c>`;
      });
      xml += `</row>`;
      dataRows.forEach((row, ri) => {
        xml += `<row r="${ri+2}">`;
        headers.forEach((h, ci) => {
          const val = row[h];
          if (val === '' || val === null || val === undefined) {
            xml += `<c r="${colLetter(ci+1)}${ri+2}" t="inlineStr"><is><t></t></is></c>`;
          } else if (typeof val === 'number') {
            xml += `<c r="${colLetter(ci+1)}${ri+2}"><v>${val}</v></c>`;
          } else {
            xml += `<c r="${colLetter(ci+1)}${ri+2}" t="inlineStr"><is><t>${xe(val)}</t></is></c>`;
          }
        });
        xml += `</row>`;
      });
      xml += `</sheetData></worksheet>`;
      return xml;
    };

    // Build catalog rows
    const rows = products.map((p, idx) => {
      const imgResult = imageResults[idx];
      const imgFilename = imgResult?.buffer
        ? (imageNaming === 'numero'
            ? String(idx + 1).padStart(3, '0') + '.' + imgResult.ext
            : (p.reference || `produit_${idx + 1}`) + '.' + imgResult.ext)
        : '';
      return {
        '#': idx + 1,
        'RÉFÉRENCE': p.reference || '',
        'INTITULÉ ORIGINE': p.intitule_origine || '',
        'DÉSIGNATION': p.designation || '',
        'DESCRIPTIF': p.petit_descriptif || '',
        'NOM IMAGE': imgFilename,
        'TARIF PROMO HT': p.tarif_promo_ht ?? '',
        'TARIF NORMAL HT': p.tarif_normal_ht ?? '',
        'MARQUE': p.marque || '',
        'CATÉGORIE': p.categorie || '',
        'STATUT': p.statut_validation || '',
        'CONFIANCE': p.niveau_confiance || '',
        'SOURCE INFO': p.source_info || '',
        'SOURCE IMAGE': p.source_image || '',
        'COMMENTAIRE': p.commentaire || ''
      };
    });

    // Credits summary
    const creditsUsed = batch.credits_used || products.filter(p => p.enriched).length;
    const summaryRows = [
      { 'Métrique': 'Nom du lot', 'Valeur': batch.name },
      { 'Métrique': 'Date', 'Valeur': new Date().toLocaleDateString('fr-FR') },
      { 'Métrique': 'Produits totaux', 'Valeur': products.length },
      { 'Métrique': 'Produits enrichis', 'Valeur': products.filter(p => p.enriched).length },
      { 'Métrique': 'Crédits consommés', 'Valeur': creditsUsed },
      { 'Métrique': 'Validés', 'Valeur': products.filter(p => p.statut_validation === 'Validé').length },
      { 'Métrique': 'Validés partiels', 'Valeur': products.filter(p => p.statut_validation === 'Validé partiel').length },
      { 'Métrique': 'À vérifier', 'Valeur': products.filter(p => p.statut_validation === 'À vérifier').length },
      { 'Métrique': 'Introuvables', 'Valeur': products.filter(p => p.statut_validation === 'Introuvable').length }
    ];

    const catalogHeaders = rows.length > 0 ? Object.keys(rows[0]) : ['#'];
    const sheet1 = buildSheet(rows, catalogHeaders);
    const sheet2 = buildSheet(summaryRows, ['Métrique', 'Valeur']);

    const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>
<sheet name="Catalogue" sheetId="1" r:id="rId1"/>
<sheet name="Resume credits" sheetId="2" r:id="rId2"/>
</sheets>
</workbook>`;

    const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
</Relationships>`;

    const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

    const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

    // Build XLSX zip using fflate
    const xlsxFiles = {
      '[Content_Types].xml': strToU8(contentTypesXml),
      '_rels/.rels': strToU8(rootRelsXml),
      'xl/workbook.xml': strToU8(workbookXml),
      'xl/_rels/workbook.xml.rels': strToU8(relsXml),
      'xl/worksheets/sheet1.xml': strToU8(sheet1),
      'xl/worksheets/sheet2.xml': strToU8(sheet2),
    };
    const xlsxBuffer = zipSync(xlsxFiles, { level: 0 });

    // Build outer ZIP with Excel + images using fflate
    const outerFiles = {
      'catalogue.xlsx': xlsxBuffer,
    };
    for (const r of imageResults) {
      if (!r.buffer) continue;
      const fname = imageNaming === 'numero'
        ? String(r.idx + 1).padStart(3, '0') + '.' + r.ext
        : (r.product.reference || `produit_${r.idx + 1}`) + '.' + r.ext;
      outerFiles[`images/${fname}`] = new Uint8Array(r.buffer);
    }

    const zipBuffer = zipSync(outerFiles, { level: 0 });

    // Convert to base64 in chunks to avoid stack overflow
    const CHUNK = 8192;
    let base64 = '';
    for (let i = 0; i < zipBuffer.length; i += CHUNK) {
      base64 += btoa(String.fromCharCode(...zipBuffer.subarray(i, i + CHUNK)));
    }

    const safeName = (batch.name || 'catalogue').replace(/[^a-z0-9]/gi, '_');
    return Response.json({ base64, filename: `${safeName}_export.zip` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});