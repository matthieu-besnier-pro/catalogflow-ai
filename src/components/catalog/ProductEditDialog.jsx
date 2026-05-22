import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, ExternalLink, Sparkles, Loader2 } from "lucide-react";
import StatusBadge from './StatusBadge';

export default function ProductEditDialog({ product, open, onClose, onSave, onReenrich }) {
  const [form, setForm] = useState({});
  const [isReenriching, setIsReenriching] = useState(false);

  useEffect(() => {
    if (product) setForm({ ...product });
  }, [product]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onSave(form);
  };

  const handleReenrich = async () => {
    setIsReenriching(true);
    await onSave(form);
    await onReenrich(form.id);
    setIsReenriching(false);
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            Modifier le produit
            <StatusBadge status={form.statut_validation} />
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          <div className="space-y-2">
            <Label>Référence</Label>
            <Input value={form.reference || ''} onChange={e => handleChange('reference', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Marque</Label>
            <Input value={form.marque || ''} onChange={e => handleChange('marque', e.target.value)} />
          </div>
          <div className="col-span-2 space-y-2">
            <Label>Désignation commerciale</Label>
            <Input value={form.designation || ''} onChange={e => handleChange('designation', e.target.value)} />
          </div>
          <div className="col-span-2 space-y-2">
            <Label>Descriptif court</Label>
            <Textarea
              value={form.petit_descriptif || ''}
              onChange={e => handleChange('petit_descriptif', e.target.value)}
              className="h-20"
            />
          </div>
          <div className="space-y-2">
            <Label>Tarif promo HT (€)</Label>
            <Input
              type="number"
              step="0.01"
              value={form.tarif_promo_ht || ''}
              onChange={e => handleChange('tarif_promo_ht', parseFloat(e.target.value) || null)}
            />
          </div>
          <div className="space-y-2">
            <Label>Tarif normal HT (€)</Label>
            <Input
              type="number"
              step="0.01"
              value={form.tarif_normal_ht || ''}
              onChange={e => handleChange('tarif_normal_ht', parseFloat(e.target.value) || null)}
            />
          </div>
          <div className="col-span-2 space-y-2">
            <Label>Photo produit (URL)</Label>
            <div className="flex gap-2">
              <Input
                value={form.photo_url || ''}
                onChange={e => handleChange('photo_url', e.target.value)}
                className="flex-1"
              />
              {form.photo_url && (
                <a href={form.photo_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="icon" type="button">
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </a>
              )}
            </div>
            {form.photo_url && (
              <img
                src={form.photo_url}
                alt="Produit"
                className="w-24 h-24 object-contain rounded border bg-white mt-2"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}
          </div>
          <div className="space-y-2">
            <Label>Catégorie</Label>
            <Input value={form.categorie || ''} onChange={e => handleChange('categorie', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Statut</Label>
            <Select value={form.statut_validation} onValueChange={v => handleChange('statut_validation', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Validé">Validé</SelectItem>
                <SelectItem value="Validé partiel">Validé partiel</SelectItem>
                <SelectItem value="À vérifier">À vérifier</SelectItem>
                <SelectItem value="Introuvable">Introuvable</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-2">
            <Label>Commentaire</Label>
            <Textarea
              value={form.commentaire || ''}
              onChange={e => handleChange('commentaire', e.target.value)}
              className="h-16"
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} disabled={isReenriching}>Annuler</Button>
          {onReenrich && (
            <Button
              variant="outline"
              onClick={handleReenrich}
              disabled={isReenriching}
              className="gap-2 border-primary/40 text-primary hover:bg-primary/5"
            >
              {isReenriching ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Re-enrichissement...</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Sauvegarder & Re-enrichir</>
              )}
            </Button>
          )}
          <Button onClick={handleSave} disabled={isReenriching} className="gap-2">
            <Save className="w-4 h-4" />
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}