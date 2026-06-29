import React from 'react';

// Bandeau identitaire style "Gonnin Duris – Le Rendez-vous des Bonnes Affaires"
// Inspiré de la page 1 du mailing Été 2025
export default function CatagriPageHeader({ opts, coverData, colors, filiale, filialeName, pageNum }) {
  const promoTitle = opts.promoTitle || coverData?.title || 'LE RENDEZ-VOUS DES BONNES AFFAIRES';
  const promoDateFrom = opts.promoDateFrom || '';
  const promoDateTo = opts.promoDateTo || '';
  const promoYear = opts.promoYear || new Date().getFullYear().toString();

  // Catégories à afficher dans le bandeau droit
  const cats = opts.headerCategories || [];

  return (
    <div
      style={{
        background: '#fff',
        borderBottom: `3px solid ${colors.accent}`,
        display: 'flex',
        alignItems: 'stretch',
        minHeight: 100,
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* Colonne gauche : logo + slogan */}
      <div
        style={{
          background: colors.primary,
          minWidth: 220,
          padding: '14px 18px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        {/* Logo/nom filiale */}
        <div>
          {filiale === 'gonninduris' ? (
            <div style={{ color: '#fff', fontWeight: 900, fontSize: 22, lineHeight: 1.1, letterSpacing: 0 }}>
              <span style={{ fontStyle: 'italic' }}>Gonnin</span>
              <br />
              <span>Duris</span>
              <div style={{
                width: 40, height: 3, background: colors.accent, marginTop: 4, borderRadius: 2,
              }} />
            </div>
          ) : (
            <div style={{ color: '#fff', fontWeight: 900, fontSize: 18, lineHeight: 1.1, textTransform: 'uppercase' }}>
              {filialeName || 'CATALOGUE'}
            </div>
          )}
        </div>

        {/* Titre promo */}
        <div style={{ marginTop: 8 }}>
          <div style={{
            fontWeight: 900,
            fontSize: 11,
            color: '#fff',
            opacity: 0.85,
            textTransform: 'uppercase',
            letterSpacing: 1,
            lineHeight: 1.3,
          }}>
            {promoTitle}
          </div>
          {promoYear && (
            <div style={{
              fontWeight: 900,
              fontSize: 20,
              color: colors.accent,
              letterSpacing: 2,
              lineHeight: 1,
              marginTop: 2,
            }}>
              {promoYear}
            </div>
          )}
        </div>
      </div>

      {/* Colonne centrale : dates + bandeau jaune */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {/* Dates en haut à droite */}
        {(promoDateFrom || promoDateTo) && (
          <div style={{
            background: colors.primary,
            color: '#fff',
            fontWeight: 900,
            fontSize: 13,
            textAlign: 'center',
            padding: '8px 16px',
            textTransform: 'uppercase',
            letterSpacing: 1,
            lineHeight: 1.4,
          }}>
            {promoDateFrom && <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.85 }}>DU {promoDateFrom}</div>}
            {promoDateTo && <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.85 }}>AU {promoDateTo}</div>}
          </div>
        )}

        {/* Bandeau catégories */}
        {cats.length > 0 && (
          <div style={{
            background: colors.accent,
            padding: '6px 16px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px 16px',
            alignItems: 'center',
          }}>
            {cats.map((cat, i) => (
              <span key={i} style={{
                fontWeight: 800,
                fontSize: 10,
                color: colors.primary,
                textTransform: 'uppercase',
                letterSpacing: 0.8,
              }}>
                {cat}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}