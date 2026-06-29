import React from 'react';
import CatagriProductCard from './CatagriProductCard';
import CatagriPageHeader from './CatagriPageHeader';
import CatagriPageFooter from './CatagriPageFooter';
import CatagriTableView from './CatagriTableView';

const FILIALE_COLORS = {
  none:          { primary: '#1a2744', accent: '#cc0000' },
  agrimontauban: { primary: '#1a2744', accent: '#f5c518' },
  agrisanterre:  { primary: '#c0392b', accent: '#c0392b' },
  migaud:        { primary: '#1a1a1a', accent: '#c0392b' },
  sicloe:        { primary: '#1a2744', accent: '#f5c518' },
  gonninduris:   { primary: '#044578', accent: '#FCC72F' },
  agrizone:      { primary: '#0265A9', accent: '#E0592A' },
  tmc:           { primary: '#1a1a1a', accent: '#E9530E' },
};

const FILIALE_NAMES = {
  none: '',
  agrimontauban: 'AGRI MONTAUBAN',
  agrisanterre:  'AGRI SANTERRE',
  migaud:        'MIGAUD',
  sicloe:        'SICLOE',
  gonninduris:   'GONNIN DURIS',
  agrizone:      'AGRIZONE',
  tmc:           'TMC',
};

export default function CatagriPageView({ products, opts, coverData, isFirstPage, allCategories = [], pageNum = 1 }) {
  const filiale = opts.filiale || 'none';
  const colors = FILIALE_COLORS[filiale] || FILIALE_COLORS.none;
  const filialeName = FILIALE_NAMES[filiale] || '';

  // Page A4 portrait simulée : 794px × 1123px à 96dpi
  const PAGE_W = 794;
  const PAGE_H = 1123;

  // Grid
  const cols = opts.cols || 4;
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gap: `${opts.gap || 8}px`,
  };

  const headerStyle = opts.headerStyle || 'simple'; // 'simple' | 'promo'
  const footerStyle = opts.footerStyle || 'simple'; // 'simple' | 'magasins'

  return (
    <div
      style={{
        width: PAGE_W,
        minHeight: PAGE_H,
        background: '#fff',
        boxShadow: '0 4px 32px rgba(0,0,0,0.18)',
        borderRadius: 4,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Inter', Arial, sans-serif",
      }}
    >
      {/* En-tête */}
      {opts.showHeader && (
        headerStyle === 'promo' ? (
          <CatagriPageHeader
            opts={opts}
            coverData={coverData}
            colors={colors}
            filiale={filiale}
            filialeName={filialeName}
            pageNum={pageNum}
          />
        ) : (
          /* Header simple */
          <div
            style={{
              background: colors.primary,
              color: '#fff',
              padding: '10px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 6, height: 28, background: colors.accent, borderRadius: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: 1, textTransform: 'uppercase' }}>
                  {filialeName || coverData?.title || 'CATALOGUE'}
                </div>
                <div style={{ fontSize: 10, opacity: 0.7, marginTop: 1 }}>
                  {coverData?.title}
                </div>
              </div>
            </div>
            <div style={{
              background: colors.accent,
              color: '#fff',
              fontWeight: 700,
              fontSize: 11,
              padding: '3px 10px',
              borderRadius: 3,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}>
              {opts.template}
            </div>
          </div>
        )
      )}

      {/* Catégorie de page (bandeau section style page 2/3 du PDF) */}
      {opts.showSectionBanner && products[0]?.famille && (
        <div style={{
          background: colors.accent,
          color: colors.primary,
          fontWeight: 900,
          fontSize: 13,
          padding: '6px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}>
          <div style={{ width: 16, height: 16, background: colors.primary, borderRadius: 3, flexShrink: 0 }} />
          {products[0].famille}
        </div>
      )}

      {/* Grille ou tableau produits */}
      <div style={{ flex: 1, padding: `${opts.padding}px`, background: opts.template === 'tableau' ? '#fff' : '#f8f8f8', overflowY: 'auto' }}>
        {products.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#aaa', fontSize: 13, paddingTop: 60 }}>
            Aucun produit sur cette page
          </div>
        ) : opts.template === 'tableau' ? (
          <CatagriTableView products={products} colors={colors} opts={opts} />
        ) : (
          <div style={gridStyle}>
            {products.map(p => (
              <CatagriProductCard
                key={p._id}
                product={p}
                colors={colors}
                template={opts.template}
                opts={opts}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pied de page */}
      {opts.showFooter && (
        <CatagriPageFooter
          opts={opts}
          colors={colors}
          filiale={filiale}
          filialeName={filialeName}
          pageNum={pageNum}
        />
      )}
    </div>
  );
}