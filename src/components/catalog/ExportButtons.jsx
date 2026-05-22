import React from 'react';
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet } from "lucide-react";

export default function ExportButtons({ products }) {
  const exportCSV = () => {
    const headers = [
      'REFERENCE', 'INTITULE_ORIGINE', 'DESIGNATION', 'PETIT_DESCRIPTIF',
      'PHOTO_DU_PRODUIT', 'TARIF_PROMO_HT', 'TARIF_NORMAL_HT', 'MARQUE',
      'CATEGORIE', 'SOURCE_IMAGE', 'SOURCE_INFO', 'NIVEAU_CONFIANCE',
      'STATUT_VALIDATION', 'COMMENTAIRE'
    ];

    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(';') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = products.map(p => [
      p.reference,
      p.intitule_origine,
      p.designation,
      p.petit_descriptif,
      p.photo_url,
      p.tarif_promo_ht,
      p.tarif_normal_ht,
      p.marque,
      p.categorie,
      p.source_image,
      p.source_info,
      p.niveau_confiance,
      p.statut_validation,
      p.commentaire
    ].map(escapeCSV).join(';'));

    const bom = '\uFEFF';
    const csv = bom + headers.join(';') + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `catalogue_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex gap-3">
      <Button onClick={exportCSV} className="gap-2 shadow-lg shadow-primary/20">
        <Download className="w-4 h-4" />
        Exporter mon catalogue (CSV)
      </Button>
    </div>
  );
}