import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function ExportToCatagri({ products, batchName, open, onClose }) {
  const [template, setTemplate] = useState('catalogue');
  const [density, setDensity] = useState('16');
  const [cols, setCols] = useState('4');
  const [filiale, setFiliale] = useState('');

  const FILIALES = [
    { id: '', name: '— Sans filiale —', primary: '#1a2744', accent: '#cc0000' },
    { id: 'agrimontauban', name: 'Agri Montauban', primary: '#1a2744', accent: '#f5c518' },
    { id: 'agrisanterre', name: 'Agri Santerre', primary: '#c0392b', accent: '#c0392b' },
    { id: 'migaud', name: 'Migaud', primary: '#1a1a1a', accent: '#c0392b' },
    { id: 'sicloe', name: 'Sicloe', primary: '#1a2744', accent: '#f5c518' },
    { id: 'gonninduris', name: 'Gonnin Duris', primary: '#044578', accent: '#FCC72F' },
    { id: 'agrizone', name: 'Agrizone', primary: '#0265A9', accent: '#E0592A' },
    { id: 'tmc', name: 'TMC', primary: '#1a1a1a', accent: '#E9530E' },
  ];

  // Mapping CatalogIA → CAT'AGRI
  const buildCatagriProducts = () => {
    return products.map((p, idx) => ({
      _id: p.id || ('p_' + idx),
      ordre: idx + 1,
      page: String(idx < parseInt(density) ? 1 : Math.floor(idx / parseInt(density)) + 1),
      famille: p.categorie || '',
      refF: p.reference || '',
      nom: p.designation || p.intitule_origine || '',
      desc: p.petit_descriptif || '',
      photo: p.photo_url || '',
      prix: p.tarif_promo_ht ? String(p.tarif_promo_ht).replace('.', ',') : '',
      prixA: p.tarif_normal_ht ? String(p.tarif_normal_ht).replace('.', ',') : '',
      format: 'normal',
      badge: '',
      dispo: '',
      featured: false,
    }));
  };

  const handleExport = () => {
    const catagriProducts = buildCatagriProducts();
    const projet = {
      v: '9',
      products: catagriProducts,
      encarts: [],
      cover: {
        title: batchName || 'Catalogue',
        sub: new Date().getFullYear().toString(),
        img: '', backTitle: '', backInfo: '', backImg: ''
      },
      filiale: filiale || null,
      format: 'a4p',
      density: parseInt(density),
      template,
      mode: 'catalogue',
      cols: parseInt(cols),
      priceStyle: 'bandeau',
    };

    // Écrire dans localStorage (clé utilisée par CAT'AGRI = 'cf9')
    try {
      localStorage.setItem('cf9', JSON.stringify(projet));
    } catch (e) {
      console.warn('localStorage plein, export JSON uniquement');
    }

    // Télécharger aussi le JSON
    const blob = new Blob([JSON.stringify(projet, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `catagri_${batchName || 'catalogue'}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>🎨</span> Exporter vers CAT'AGRI
          </DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-4">
          <p className="text-sm text-muted-foreground">
            Génère un fichier <code>.json</code> compatible avec l'outil de mise en page CAT'AGRI.
            Il suffit ensuite de le charger dans CAT'AGRI via <strong>📂 Charger projet .json</strong>.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Filiale</Label>
              <Select value={filiale} onValueChange={setFiliale}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FILIALES.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Template</Label>
              <Select value={template} onValueChange={setTemplate}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="catalogue">Catalogue</SelectItem>
                  <SelectItem value="magazine">Magazine</SelectItem>
                  <SelectItem value="promo">Promo</SelectItem>
                  <SelectItem value="brico">Brico</SelectItem>
                  <SelectItem value="tableau">Tableau</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Densité (produits/page)</Label>
              <Select value={density} onValueChange={setDensity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="12">12</SelectItem>
                  <SelectItem value="16">16</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="24">24</SelectItem>
                  <SelectItem value="30">30</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Colonnes</Label>
              <Select value={cols} onValueChange={setCols}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg bg-muted px-4 py-3 text-xs text-muted-foreground space-y-1">
            <p>✓ <strong>{products.length}</strong> produits seront exportés</p>
            <p>✓ Désignations, descriptifs, photos, prix inclus</p>
            <p>✓ Catégories → Familles CAT'AGRI</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleExport} className="gap-2">
            <span>⬇️</span> Télécharger .json
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}