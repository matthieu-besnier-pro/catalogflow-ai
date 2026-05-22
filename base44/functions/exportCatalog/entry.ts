import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });

    const { batchId, imageNaming } = await req.json();
    // imageNaming: "ref" | "numero"
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

    // Build file map: filename -> ArrayBuffer
    const files = {};

    // Excel data
    const rows = products.map((p, idx) => {
      const imgFilename = imageResults[idx]?.buffer
        ? (imageNaming === 'numero'
            ? String(idx + 1).padStart(3, '0') + '.' + imageResults[idx].ext
            : (p.reference || `produit_${idx + 1}`) + '.' + imageResults[idx].ext)
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

    // Credits summary sheet
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

    // Build XLSX manually (binary format)
    // We'll encode the data as a simple XML-based XLSX using the Office Open XML format
    // Using a minimal approach without external XLSX library in Deno

    // Helper: escape XML
    const xe = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const buildSheet = (dataRows, headers) => {
      let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>`;
      const colLetter = (n) => { let s = ''; while (n > 0) { s = String.fromCharCode(65 + ((n-1) % 26)) + s; n = Math.floor((n-1) / 26); } return s; };

      // Header row
      xml += `<row r="1">`;
      headers.forEach((h, ci) => {
        xml += `<c r="${colLetter(ci+1)}1" t="inlineStr"><is><t>${xe(h)}</t></is></c>`;
      });
      xml += `</row>`;

      // Data rows
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

    const catalogHeaders = Object.keys(rows[0] || { '#': '' });
    const summaryHeaders = ['Métrique', 'Valeur'];

    const sheet1 = buildSheet(rows, catalogHeaders);
    const sheet2 = buildSheet(summaryRows, summaryHeaders);

    const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>
<sheet name="Catalogue" sheetId="1" r:id="rId1"/>
<sheet name="Résumé crédits" sheetId="2" r:id="rId2"/>
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

    // Build ZIP manually (without external lib)
    const enc = new TextEncoder();

    const zipFiles = {
      '[Content_Types].xml': enc.encode(contentTypesXml),
      '_rels/.rels': enc.encode(rootRelsXml),
      'xl/workbook.xml': enc.encode(workbookXml),
      'xl/_rels/workbook.xml.rels': enc.encode(relsXml),
      'xl/worksheets/sheet1.xml': enc.encode(sheet1),
      'xl/worksheets/sheet2.xml': enc.encode(sheet2),
    };

    // Add images to zip
    for (const r of imageResults) {
      if (!r.buffer) continue;
      const fname = imageNaming === 'numero'
        ? String(r.idx + 1).padStart(3, '0') + '.' + r.ext
        : (r.product.reference || `produit_${r.idx + 1}`) + '.' + r.ext;
      zipFiles[`images/${fname}`] = new Uint8Array(r.buffer);
    }

    // ZIP builder (store only, no compression)
    const zipParts = [];
    const centralDirectory = [];
    let offset = 0;

    const crc32 = (data) => {
      const table = (() => {
        const t = new Uint32Array(256);
        for (let i = 0; i < 256; i++) {
          let c = i;
          for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
          t[i] = c;
        }
        return t;
      })();
      let crc = 0xFFFFFFFF;
      for (let i = 0; i < data.length; i++) crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
      return (crc ^ 0xFFFFFFFF) >>> 0;
    };

    const writeUint16LE = (v) => new Uint8Array([v & 0xFF, (v >> 8) & 0xFF]);
    const writeUint32LE = (v) => new Uint8Array([v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF, (v >> 24) & 0xFF]);

    for (const [name, data] of Object.entries(zipFiles)) {
      const nameBytes = enc.encode(name);
      const crc = crc32(data);
      const size = data.length;

      // Local file header
      const localHeader = new Uint8Array([
        0x50, 0x4B, 0x03, 0x04, // signature
        0x14, 0x00,             // version needed
        0x00, 0x00,             // flags
        0x00, 0x00,             // compression (store)
        0x00, 0x00, 0x00, 0x00, // mod time/date
        ...writeUint32LE(crc),
        ...writeUint32LE(size),
        ...writeUint32LE(size),
        ...writeUint16LE(nameBytes.length),
        0x00, 0x00,             // extra field length
        ...nameBytes
      ]);

      centralDirectory.push({ name, nameBytes, crc, size, offset });
      offset += localHeader.length + size;

      zipParts.push(localHeader);
      zipParts.push(data);
    }

    // Central directory
    const cdStart = offset;
    for (const entry of centralDirectory) {
      const cdEntry = new Uint8Array([
        0x50, 0x4B, 0x01, 0x02, // signature
        0x14, 0x00,             // version made by
        0x14, 0x00,             // version needed
        0x00, 0x00,             // flags
        0x00, 0x00,             // compression
        0x00, 0x00, 0x00, 0x00, // mod time/date
        ...writeUint32LE(entry.crc),
        ...writeUint32LE(entry.size),
        ...writeUint32LE(entry.size),
        ...writeUint16LE(entry.nameBytes.length),
        0x00, 0x00,             // extra
        0x00, 0x00,             // comment
        0x00, 0x00,             // disk start
        0x00, 0x00,             // int attribs
        0x00, 0x00, 0x00, 0x00, // ext attribs
        ...writeUint32LE(entry.offset),
        ...entry.nameBytes
      ]);
      zipParts.push(cdEntry);
      offset += cdEntry.length;
    }

    // End of central directory
    const cdSize = offset - cdStart;
    const eocd = new Uint8Array([
      0x50, 0x4B, 0x05, 0x06,
      0x00, 0x00,
      0x00, 0x00,
      ...writeUint16LE(centralDirectory.length),
      ...writeUint16LE(centralDirectory.length),
      ...writeUint32LE(cdSize),
      ...writeUint32LE(cdStart),
      0x00, 0x00
    ]);
    zipParts.push(eocd);

    // Merge all parts
    const totalSize = zipParts.reduce((s, p) => s + p.length, 0);
    const zipBuffer = new Uint8Array(totalSize);
    let pos = 0;
    for (const part of zipParts) { zipBuffer.set(part, pos); pos += part.length; }

    // Encode as base64 for JSON transport (invoke() doesn't support binary responses)
    let binary = '';
    for (let i = 0; i < zipBuffer.length; i++) {
      binary += String.fromCharCode(zipBuffer[i]);
    }
    const base64 = btoa(binary);
    const safeName = (batch.name || 'catalogue').replace(/[^a-z0-9]/gi, '_');
    return Response.json({ base64, filename: `${safeName}_export.zip` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});