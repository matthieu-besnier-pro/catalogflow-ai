import React, { useState } from 'react';

export default function CatagriProductCard({ product, colors, template, opts = {} }) {
  const [imgError, setImgError] = useState(false);

  const hasPromo = product.prix && product.prixA && product.prixA !== product.prix;
  const isPromo = template === 'promo';
  
  const textSizeFactors = { small: 0.85, normal: 1, large: 1.15 };
  const sf = textSizeFactors[opts.textSize] || 1;

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 5,
        border: `1px solid ${isPromo ? colors.accent + '44' : '#e5e5e5'}`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: isPromo ? `0 2px 8px ${colors.accent}22` : '0 1px 3px rgba(0,0,0,0.07)',
        position: 'relative',
        transition: 'box-shadow 0.2s',
      }}
    >
      {/* Badge promo */}
      {hasPromo && opts.showBadges !== false && (
        <div
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            background: colors.accent,
            color: '#fff',
            fontSize: 8,
            fontWeight: 700,
            padding: '2px 5px',
            borderRadius: 3,
            zIndex: 2,
            textTransform: 'uppercase',
            letterSpacing: 0.3,
          }}
        >
          PROMO
        </div>
      )}

      {/* Image */}
      <div
        style={{
          background: '#f5f5f5',
          height: 90,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid #ececec',
          overflow: 'hidden',
        }}
      >
        {product.photo && !imgError ? (
          <img
            src={product.photo}
            alt={product.nom}
            onError={() => setImgError(true)}
            style={{
              maxHeight: '100%',
              maxWidth: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        ) : (
          <div style={{ color: '#ccc', fontSize: 10, textAlign: 'center', padding: 8 }}>
            {product.photo ? '⚠️ Image\nindisponible' : '📷'}
          </div>
        )}
      </div>

      {/* Infos */}
      <div style={{ padding: `${7 * sf}px ${8 * sf}px`, flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Référence */}
        {opts.showReference !== false && (
          <div style={{ fontSize: 8 * sf, color: '#999', fontFamily: 'monospace', letterSpacing: 0.3 }}>
            {product.refF}
          </div>
        )}

        {/* Nom */}
        <div
          style={{
            fontSize: 10 * sf,
            fontWeight: 600,
            color: '#1a1a1a',
            lineHeight: 1.3,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {product.nom || '—'}
        </div>

        {/* Description */}
        {product.desc && opts.showDesc !== false && (
          <div
            style={{
              fontSize: 8.5 * sf,
              color: '#666',
              lineHeight: 1.35,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {product.desc}
          </div>
        )}

        {/* Famille */}
        {product.famille && opts.showCategory !== false && (
          <div style={{
            fontSize: 7.5 * sf,
            color: colors.primary,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: 0.4,
            marginTop: 'auto',
            paddingTop: 2,
          }}>
            {product.famille}
          </div>
        )}
      </div>

      {/* Prix */}
      {opts.priceStyle === 'bandeau' ? (
        <div
          style={{
            background: colors.primary,
            color: '#fff',
            padding: `${5 * sf}px ${8 * sf}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          {hasPromo ? (
            <>
              <span style={{ fontSize: 8 * sf, color: 'rgba(255,255,255,0.5)', textDecoration: 'line-through' }}>
                {product.prixA} €
              </span>
              <span style={{ fontSize: 13 * sf, fontWeight: 800, color: colors.accent }}>
                {product.prix} €
              </span>
            </>
          ) : product.prix ? (
            <span style={{ fontSize: 13 * sf, fontWeight: 800, marginLeft: 'auto' }}>
              {product.prix} €
            </span>
          ) : (
            <span style={{ fontSize: 9 * sf, color: 'rgba(255,255,255,0.5)', marginLeft: 'auto' }}>
              Nous consulter
            </span>
          )}
        </div>
      ) : opts.priceStyle === 'coin' ? (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            background: colors.accent,
            color: '#fff',
            fontWeight: 800,
            fontSize: 13 * sf,
            padding: '2px 6px',
            borderRadius: 2,
          }}
        >
          {product.prix ? `${product.prix}€` : 'Devis'}
        </div>
      ) : null}
    </div>
  );
}