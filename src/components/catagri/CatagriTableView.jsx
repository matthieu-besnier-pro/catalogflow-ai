import React from 'react';

// Vue tableau style fichier Excel Gonnin Duris
// Colonnes : N° | RÉFÉRENCE | DÉSIGNATION | PRIX € HT | COMMENTAIRE
export default function CatagriTableView({ products, colors, opts }) {
  const showComment = opts.showDesc !== false;
  const showRef = opts.showReference !== false;

  const formatPrice = (prix) => {
    if (!prix) return '—';
    const num = parseFloat(String(prix).replace(',', '.'));
    if (isNaN(num)) return prix;
    return num % 1 === 0
      ? `${num.toLocaleString('fr-FR')} €`
      : `${num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  };

  return (
    <div style={{ width: '100%', overflowX: 'hidden' }}>
      {/* En-tête du tableau */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: showRef ? '32px 90px 1fr 80px' + (showComment ? ' 130px' : '') : '32px 1fr 80px' + (showComment ? ' 130px' : ''),
        background: colors.primary,
        color: '#fff',
        fontWeight: 800,
        fontSize: 9,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        borderRadius: '4px 4px 0 0',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '7px 6px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.15)' }}>N°</div>
        {showRef && (
          <div style={{ padding: '7px 8px', borderRight: '1px solid rgba(255,255,255,0.15)' }}>Référence</div>
        )}
        <div style={{ padding: '7px 8px', borderRight: '1px solid rgba(255,255,255,0.15)' }}>Désignation</div>
        <div style={{ padding: '7px 8px', textAlign: 'right', borderRight: showComment ? '1px solid rgba(255,255,255,0.15)' : 'none' }}>
          Prix € HT
        </div>
        {showComment && (
          <div style={{ padding: '7px 8px' }}>Commentaire</div>
        )}
      </div>

      {/* Lignes */}
      <div style={{ border: `1px solid ${colors.primary}33`, borderTop: 'none', borderRadius: '0 0 4px 4px', overflow: 'hidden' }}>
        {products.map((product, idx) => {
          const isEven = idx % 2 === 0;
          const hasPromo = product.prix && product.prixA && product.prixA !== product.prix;
          return (
            <div
              key={product._id}
              style={{
                display: 'grid',
                gridTemplateColumns: showRef ? '32px 90px 1fr 80px' + (showComment ? ' 130px' : '') : '32px 1fr 80px' + (showComment ? ' 130px' : ''),
                background: isEven ? '#fff' : '#f5f7fb',
                borderBottom: idx < products.length - 1 ? `1px solid ${colors.primary}18` : 'none',
                alignItems: 'center',
                minHeight: 28,
              }}
            >
              {/* N° */}
              <div style={{
                padding: '5px 6px',
                textAlign: 'center',
                fontSize: 9,
                color: '#999',
                borderRight: `1px solid ${colors.primary}15`,
                fontWeight: 600,
                flexShrink: 0,
              }}>
                {product.ordre || idx + 1}
              </div>

              {/* Référence */}
              {showRef && (
                <div style={{
                  padding: '5px 8px',
                  fontSize: 9,
                  fontFamily: 'monospace',
                  color: colors.primary,
                  fontWeight: 700,
                  borderRight: `1px solid ${colors.primary}15`,
                  wordBreak: 'break-all',
                }}>
                  {product.refF || '—'}
                </div>
              )}

              {/* Désignation */}
              <div style={{
                padding: '5px 8px',
                fontSize: 9.5,
                fontWeight: 600,
                color: '#1a1a1a',
                lineHeight: 1.35,
                borderRight: `1px solid ${colors.primary}15`,
              }}>
                {product.nom || (
                  <span style={{ color: '#bbb', fontStyle: 'italic', fontWeight: 400 }}>—</span>
                )}
              </div>

              {/* Prix */}
              <div style={{
                padding: '5px 8px',
                textAlign: 'right',
                borderRight: showComment ? `1px solid ${colors.primary}15` : 'none',
              }}>
                {hasPromo ? (
                  <div>
                    <div style={{ fontSize: 7.5, color: '#aaa', textDecoration: 'line-through', lineHeight: 1 }}>
                      {formatPrice(product.prixA)}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 900, color: colors.accent, lineHeight: 1.2 }}>
                      {formatPrice(product.prix)}
                    </div>
                  </div>
                ) : (
                  <div style={{
                    fontSize: 11,
                    fontWeight: 900,
                    color: colors.primary,
                    lineHeight: 1,
                  }}>
                    {formatPrice(product.prix)}
                  </div>
                )}
              </div>

              {/* Commentaire */}
              {showComment && (
                <div style={{
                  padding: '5px 8px',
                  fontSize: 8.5,
                  color: '#666',
                  fontStyle: 'italic',
                  lineHeight: 1.3,
                }}>
                  {product.desc || ''}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}