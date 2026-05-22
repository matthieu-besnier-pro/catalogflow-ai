import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Download, FileArchive, Hash, Tag, Loader2 } from "lucide-react";
import { base44 } from '@/api/base44Client';
import { toast } from "sonner";

export default function ExportDialog({ open, onClose, products, batchId, batchName }) {
  const [imageNaming, setImageNaming] = useState('ref');
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await base44.functions.fetch('exportCatalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId, imageNaming })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Erreur export (${res.status}): ${errText}`);
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      const safeName = (batchName || 'catalogue').replace(/[^a-z0-9]/gi, '_');
      a.download = `${safeName}_export.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
      onClose();
    } catch (err) {
      console.error('Export error:', err);
      toast.error(`Erreur lors de l'export : ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const imagesWithUrl = products.filter(p => p.photo_url).length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileArchive className="w-5 h-5 text-primary" />
            Exporter le catalogue
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Info */}
          <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
            <p className="font-medium">{products.length} produits dans ce lot</p>
            <p className="text-muted-foreground">{imagesWithUrl} images disponibles</p>
          </div>

          {/* Contenu du ZIP */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Contenu du ZIP</Label>
            <ul className="text-sm text-muted-foreground space-y-1 ml-2">
              <li className="flex items-center gap-2">
                <span className="text-primary">✓</span> Fichier Excel (.xlsx) — Catalogue + Résumé crédits
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary">✓</span> Dossier <code className="bg-muted px-1 rounded">images/</code> — {imagesWithUrl} photos produit
              </li>
            </ul>
          </div>

          {/* Nommage des images */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Nommage des images</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setImageNaming('ref')}
                className={`flex items-center gap-2 p-3 rounded-lg border-2 text-sm text-left transition-all ${
                  imageNaming === 'ref'
                    ? 'border-primary bg-primary/5 text-primary font-medium'
                    : 'border-border hover:border-muted-foreground/40'
                }`}
              >
                <Tag className="w-4 h-4 shrink-0" />
                <div>
                  <p className="font-medium">Par référence</p>
                  <p className="text-xs text-muted-foreground">ex: 7000550FR.jpg</p>
                </div>
              </button>
              <button
                onClick={() => setImageNaming('numero')}
                className={`flex items-center gap-2 p-3 rounded-lg border-2 text-sm text-left transition-all ${
                  imageNaming === 'numero'
                    ? 'border-primary bg-primary/5 text-primary font-medium'
                    : 'border-border hover:border-muted-foreground/40'
                }`}
              >
                <Hash className="w-4 h-4 shrink-0" />
                <div>
                  <p className="font-medium">Par numéro</p>
                  <p className="text-xs text-muted-foreground">ex: 001.jpg, 002.jpg</p>
                </div>
              </button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isExporting}>Annuler</Button>
          <Button onClick={handleExport} disabled={isExporting} className="gap-2">
            {isExporting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Préparation...</>
            ) : (
              <><Download className="w-4 h-4" /> Télécharger le ZIP</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}