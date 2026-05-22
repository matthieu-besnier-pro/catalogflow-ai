import React from 'react';
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const FILIALES = [
  { id: 'none', name: '— Sans filiale —', primary: '#1a2744', accent: '#cc0000' },
  { id: 'agrimontauban', name: 'Agri Montauban', primary: '#1a2744', accent: '#f5c518' },
  { id: 'agrisanterre', name: 'Agri Santerre', primary: '#c0392b', accent: '#c0392b' },
  { id: 'migaud', name: 'Migaud', primary: '#1a1a1a', accent: '#c0392b' },
  { id: 'sicloe', name: 'Sicloe', primary: '#1a2744', accent: '#f5c518' },
  { id: 'gonninduris', name: 'Gonnin Duris', primary: '#044578', accent: '#FCC72F' },
  { id: 'agrizone', name: 'Agrizone', primary: '#0265A9', accent: '#E0592A' },
  { id: 'tmc', name: 'TMC', primary: '#1a1a1a', accent: '#E9530E' },
];

const TEMPLATES = [
  { id: 'catalogue', label: 'Catalogue' },
  { id: 'magazine', label: 'Magazine' },
  { id: 'promo', label: 'Promo' },
  { id: 'brico', label: 'Brico' },
  { id: 'tableau', label: 'Tableau' },
];

export default function CatagriToolbar({ opts, onChange, productCount }) {
  const set = (key, val) => onChange(prev => ({ ...prev, [key]: val }));

  const filiale = FILIALES.find(f => f.id === (opts.filiale || 'none')) || FILIALES[0];

  return (
    <div className="p-4 space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Mise en page</p>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Filiale</Label>
            <Select value={opts.filiale || 'none'} onValueChange={v => set('filiale', v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FILIALES.map(f => <SelectItem key={f.id} value={f.id} className="text-xs">{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Template</Label>
            <Select value={opts.template} onValueChange={v => set('template', v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEMPLATES.map(t => <SelectItem key={t.id} value={t.id} className="text-xs">{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Densité (produits/page)</Label>
            <Select value={String(opts.density)} onValueChange={v => set('density', parseInt(v))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[8, 12, 16, 20, 24, 30].map(d => <SelectItem key={d} value={String(d)} className="text-xs">{d} produits</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Colonnes</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {[3, 4, 5].map(c => (
                <button
                  key={c}
                  onClick={() => set('cols', c)}
                  className={`py-1.5 rounded text-xs font-medium border transition-all ${
                    opts.cols === c
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {c} col.
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Couleurs de la filiale */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Couleurs</p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded border" style={{ background: filiale.primary }} />
            <span className="text-xs text-muted-foreground">Primaire</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded border" style={{ background: filiale.accent }} />
            <span className="text-xs text-muted-foreground">Accent</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-muted/60 rounded-lg p-3 space-y-1 text-xs text-muted-foreground">
        <p>📦 <strong className="text-foreground">{productCount}</strong> produits</p>
        <p>📄 <strong className="text-foreground">{Math.ceil(productCount / opts.density)}</strong> pages générées</p>
        <p>⬛ <strong className="text-foreground">{opts.cols}</strong> colonnes × {Math.ceil(opts.density / opts.cols)} lignes</p>
      </div>
    </div>
  );
}