import React from 'react';

// Pied de page style "Magasins Participants" — page 4 du mailing Gonnin Duris
export default function CatagriPageFooter({ opts, colors, filiale, filialeName, pageNum }) {
  const stores = opts.stores || [];
  const legalText = opts.legalText || 'Les prix sont HT ajouter 20% pour les prix TTC. Document d\'illustration non contractuel sous réserve d\'erreurs typographiques. Offre valable dans la limite des stocks disponibles. NE PAS JETER SUR LA VOIE PUBLIQUE';
  const contactName = opts.contactName || '';
  const contactRole = opts.contactRole || '';
  const contactPhone = opts.contactPhone || '';

  const hasStores = stores.length > 0 || contactName;
  const showFullFooter = opts.footerStyle === 'magasins' && hasStores;

  if (showFullFooter) {
    return (
      <div style={{ flexShrink: 0 }}>
        {/* Bandeau "MAGASINS PARTICIPANTS" */}
        <div style={{
          background: colors.primary,
          color: '#fff',
          fontWeight: 900,
          fontSize: 13,
          textAlign: 'center',
          padding: '7px 20px',
          letterSpacing: 2,
          textTransform: 'uppercase',
        }}>
          MAGASINS PARTICIPANTS
        </div>

        {/* Contenu footer */}
        <div style={{
          background: '#f5f7fb',
          borderTop: `3px solid ${colors.accent}`,
          padding: '10px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}>
          {/* Logo */}
          <div style={{ minWidth: 90, flexShrink: 0 }}>
            {filiale === 'gonninduris' ? (
              <div style={{ color: colors.primary, fontWeight: 900, fontSize: 18, lineHeight: 1.1, fontStyle: 'italic' }}>
                <span>Gonnin</span>
                <br />
                <span style={{ fontStyle: 'normal' }}>Duris</span>
                <div style={{ width: 32, height: 2.5, background: colors.accent, marginTop: 3, borderRadius: 2 }} />
              </div>
            ) : (
              <div style={{ color: colors.primary, fontWeight: 900, fontSize: 14, textTransform: 'uppercase' }}>
                {filialeName}
              </div>
            )}
          </div>

          {/* Contact commercial */}
          {contactName && (
            <div style={{
              background: colors.primary,
              color: '#fff',
              borderRadius: 6,
              padding: '8px 12px',
              fontSize: 9,
              fontWeight: 600,
              textAlign: 'center',
              minWidth: 110,
              flexShrink: 0,
              lineHeight: 1.5,
            }}>
              <div style={{ fontWeight: 700, fontSize: 9.5 }}>Contactez {contactName}</div>
              {contactRole && <div style={{ opacity: 0.85, fontSize: 8.5 }}>{contactRole}</div>}
              {contactPhone && (
                <div style={{ fontWeight: 800, fontSize: 10, color: colors.accent, marginTop: 2 }}>
                  au {contactPhone}
                </div>
              )}
            </div>
          )}

          {/* Magasins */}
          <div style={{ flex: 1, display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {stores.map((store, i) => (
              <div key={i} style={{
                textAlign: 'center',
                fontSize: 8.5,
                lineHeight: 1.5,
                minWidth: 100,
              }}>
                {store.name && (
                  <div style={{ fontWeight: 800, fontSize: 9, color: colors.primary, textTransform: 'uppercase' }}>
                    {store.name}
                  </div>
                )}
                {store.address && <div style={{ color: '#444' }}>{store.address}</div>}
                {store.city && (
                  <div style={{ fontWeight: 700, color: colors.primary }}>{store.city}</div>
                )}
                {store.phone && <div style={{ color: '#555' }}>Tél : {store.phone}</div>}
                {store.email && (
                  <div style={{ color: colors.primary, fontSize: 8, fontWeight: 600 }}>{store.email}</div>
                )}
              </div>
            ))}
          </div>

          {/* Numéro de page */}
          <div style={{
            background: colors.primary,
            color: '#fff',
            fontWeight: 900,
            fontSize: 14,
            width: 28,
            height: 28,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            {pageNum}
          </div>
        </div>

        {/* Mentions légales */}
        {legalText && (
          <div style={{
            background: '#eee',
            borderTop: '1px solid #ddd',
            padding: '4px 20px',
            fontSize: 7,
            color: '#666',
            textAlign: 'center',
            lineHeight: 1.4,
          }}>
            {legalText}
          </div>
        )}
      </div>
    );
  }

  // Footer simple
  return (
    <div style={{
      background: colors.primary,
      color: 'rgba(255,255,255,0.6)',
      fontSize: 9,
      padding: '5px 20px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexShrink: 0,
    }}>
      <span style={{ color: '#fff', fontWeight: 600 }}>{filialeName || 'CAT\'AGRI Studio'}</span>
      <span style={{ color: colors.accent, fontWeight: 700, fontSize: 11 }}>{pageNum}</span>
      <span>{opts.footerText || ''}</span>
    </div>
  );
}