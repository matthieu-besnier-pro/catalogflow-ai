import React, { useState } from 'react';
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown } from "lucide-react";

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

const FORMATS = [
  { id: 'a4p', label: 'A4 Portrait' },
  { id: 'a4l', label: 'A4 Paysage' },
  { id: 'a3p', label: 'A3 Portrait' },
  { id: 'a3l', label: 'A3 Paysage' },
];

export default function CatagriToolbar({ opts, onChange, productCount, allCategories = [] }) {
  const set = (key, val) => onChange(prev => ({ ...prev, [key]: val }));
  const filiale = FILIALES.find(f => f.id === (opts.filiale || 'none')) || FILIALES[0];

  return (
    <Tabs defaultValue="layout" className="w-full h-full flex flex-col">
      <TabsList className="w-full grid grid-cols-3 h-9 rounded-none border-b border-border">
        <TabsTrigger value="layout" className="text-xs rounded-none">Mise en page</TabsTrigger>
        <TabsTrigger value="design" className="text-xs rounded-none">Design</TabsTrigger>
        <TabsTrigger value="filtre" className="text-xs rounded-none">Filtres</TabsTrigger>
      </TabsList>

      <div className="flex-1 overflow-y-auto">
        {/* MISE EN PAGE */}
        <TabsContent value="layout" className="p-4 space-y-5 mt-0">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Grille & Format</p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Format page</Label>
                <Select value={opts.format} onValueChange={v => set('format', v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORMATS.map(f => <SelectItem key={f.id} value={f.id} className="text-xs">{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Colonnes</Label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[2, 3, 4, 5, 6].map(c => (
                    <button
                      key={c}
                      onClick={() => set('cols', c)}
                      className={`py-1.5 rounded text-xs font-medium border transition-all ${
                        opts.cols === c
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Densité (produits/page)</Label>
                <Select value={String(opts.density)} onValueChange={v => set('density', parseInt(v))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[4, 6, 8, 12, 16, 20, 24, 30].map(d => <SelectItem key={d} value={String(d)} className="text-xs">{d} produits</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Espacement entre produits (px)</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="2"
                    max="20"
                    value={opts.gap}
                    onChange={e => set('gap', parseInt(e.target.value))}
                    className="flex-1 h-2"
                  />
                  <span className="text-xs font-mono bg-muted px-2 py-1 rounded w-12">{opts.gap}px</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Marges (px)</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="5"
                    max="30"
                    value={opts.padding}
                    onChange={e => set('padding', parseInt(e.target.value))}
                    className="flex-1 h-2"
                  />
                  <span className="text-xs font-mono bg-muted px-2 py-1 rounded w-12">{opts.padding}px</span>
                </div>
              </div>
            </div>
          </div>

          {/* En-tête/Pied */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Structure</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="showHeader"
                  checked={opts.showHeader}
                  onCheckedChange={v => set('showHeader', v)}
                />
                <Label htmlFor="showHeader" className="text-xs font-normal cursor-pointer">Afficher en-tête</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="showFooter"
                  checked={opts.showFooter}
                  onCheckedChange={v => set('showFooter', v)}
                />
                <Label htmlFor="showFooter" className="text-xs font-normal cursor-pointer">Afficher pied de page</Label>
              </div>
              {opts.showFooter && (
                <Input
                  placeholder="Texte du pied..."
                  value={opts.footerText}
                  onChange={e => set('footerText', e.target.value)}
                  className="h-7 text-xs mt-2"
                />
              )}
            </div>
          </div>
        </TabsContent>

        {/* DESIGN */}
        <TabsContent value="design" className="p-4 space-y-5 mt-0">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Filiale & Couleurs</p>
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

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded border" style={{ background: filiale.primary }} />
                  <span className="text-xs text-muted-foreground">Primaire</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded border" style={{ background: filiale.accent }} />
                  <span className="text-xs text-muted-foreground">Accent</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Template & Couverture</p>
            <div className="space-y-3">
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
                <Label className="text-xs">Titre couverture</Label>
                <Input
                  placeholder="Titre de la couverture..."
                  value={opts.coverTitle}
                  onChange={e => set('coverTitle', e.target.value)}
                  className="h-7 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Image couverture (URL)</Label>
                <Input
                  placeholder="https://..."
                  value={opts.coverImg}
                  onChange={e => set('coverImg', e.target.value)}
                  className="h-7 text-xs"
                />
                {opts.coverImg && (
                  <div className="flex items-center gap-2 mt-2">
                    <Checkbox
                      id="showCoverImg"
                      checked={opts.showCoverImg}
                      onCheckedChange={v => set('showCoverImg', v)}
                    />
                    <Label htmlFor="showCoverImg" className="text-xs font-normal cursor-pointer">Afficher l'image</Label>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Style Produit</p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Style prix</Label>
                <Select value={opts.priceStyle} onValueChange={v => set('priceStyle', v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bandeau" className="text-xs">Bandeau bas</SelectItem>
                    <SelectItem value="coin" className="text-xs">Coin supérieur</SelectItem>
                    <SelectItem value="text" className="text-xs">Texte simple</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Taille texte</Label>
                <Select value={opts.textSize} onValueChange={v => set('textSize', v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small" className="text-xs">Petit</SelectItem>
                    <SelectItem value="normal" className="text-xs">Normal</SelectItem>
                    <SelectItem value="large" className="text-xs">Grand</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="showRef"
                    checked={opts.showReference}
                    onCheckedChange={v => set('showReference', v)}
                  />
                  <Label htmlFor="showRef" className="text-xs font-normal cursor-pointer">Afficher référence</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="showDesc"
                    checked={opts.showDesc}
                    onCheckedChange={v => set('showDesc', v)}
                  />
                  <Label htmlFor="showDesc" className="text-xs font-normal cursor-pointer">Afficher description</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="showCat"
                    checked={opts.showCategory}
                    onCheckedChange={v => set('showCategory', v)}
                  />
                  <Label htmlFor="showCat" className="text-xs font-normal cursor-pointer">Afficher catégorie</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="showBadges"
                    checked={opts.showBadges}
                    onCheckedChange={v => set('showBadges', v)}
                  />
                  <Label htmlFor="showBadges" className="text-xs font-normal cursor-pointer">Afficher badges promo</Label>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* FILTRES */}
        <TabsContent value="filtre" className="p-4 space-y-5 mt-0">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Tri & Filtrage</p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tri par</Label>
                <Select value={opts.sortBy} onValueChange={v => set('sortBy', v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="order" className="text-xs">Ordre d'import</SelectItem>
                    <SelectItem value="name" className="text-xs">Nom (A → Z)</SelectItem>
                    <SelectItem value="price" className="text-xs">Prix (bas → haut)</SelectItem>
                    <SelectItem value="category" className="text-xs">Catégorie</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {allCategories.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Catégorie</Label>
                  <Select value={opts.filterCategory} onValueChange={v => set('filterCategory', v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">Toutes les catégories</SelectItem>
                      {allCategories.map(cat => <SelectItem key={cat} value={cat} className="text-xs">{cat}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs">Gamme de prix (€ HT)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={opts.minPrice ?? ''}
                    onChange={e => set('minPrice', e.target.value ? parseFloat(e.target.value) : null)}
                    className="h-7 text-xs"
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={opts.maxPrice ?? ''}
                    onChange={e => set('maxPrice', e.target.value ? parseFloat(e.target.value) : null)}
                    className="h-7 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="onlyPromo"
                  checked={opts.showOnlyPromo}
                  onCheckedChange={v => set('showOnlyPromo', v)}
                />
                <Label htmlFor="onlyPromo" className="text-xs font-normal cursor-pointer">Afficher uniquement les promos</Label>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="bg-muted/60 rounded-lg p-3 space-y-1 text-xs text-muted-foreground">
            <p>📦 <strong className="text-foreground">{productCount}</strong> produits au total</p>
            <p>📄 <strong className="text-foreground">{Math.ceil(productCount / opts.density)}</strong> pages (densité: {opts.density})</p>
            <p>⬛ <strong className="text-foreground">{opts.cols}×{Math.ceil(opts.density / opts.cols)}</strong> grille</p>
          </div>
        </TabsContent>
      </div>
    </Tabs>
  );
}