import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const BRAND = '#2f54d6'; // primary (hsl 225 73% 57% ≈ #3a5ae0) — ton bleu de marque

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildEmail({ appUrl, inviterName, role, personalMessage }) {
  const roleLabel = role === 'admin' ? 'Administrateur' : 'Utilisateur';
  const safeInviter = escapeHtml(inviterName);
  const safeMsg = escapeHtml(personalMessage);
  const cta = appUrl || '#';

  const perso = safeMsg
    ? `<tr><td style="padding:0 40px 8px;">
         <div style="background:#f5f7fb;border-left:3px solid ${BRAND};border-radius:8px;padding:14px 16px;color:#334155;font-size:14px;line-height:1.6;font-style:italic;">
           «&nbsp;${safeMsg}&nbsp;»
         </div>
       </td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#eef1f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f6;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,.08);">

        <!-- Bandeau -->
        <tr><td style="background:${BRAND};background:linear-gradient(135deg,${BRAND},#1e3aa8);padding:36px 40px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="width:40px;height:40px;background:rgba(255,255,255,.18);border-radius:11px;text-align:center;vertical-align:middle;font-size:20px;">✨</td>
            <td style="padding-left:12px;color:#fff;font-size:20px;font-weight:800;letter-spacing:-.3px;">CatalogIA</td>
          </tr></table>
          <div style="color:#fff;font-size:26px;font-weight:800;line-height:1.25;margin-top:22px;">Vous êtes invité·e à rejoindre&nbsp;CatalogIA</div>
        </td></tr>

        <!-- Corps -->
        <tr><td style="padding:34px 40px 10px;color:#0f172a;font-size:15px;line-height:1.65;">
          Bonjour,<br><br>
          <strong>${safeInviter || 'Un membre de l\'équipe'}</strong> vous invite à rejoindre
          <strong>CatalogIA</strong>, l'outil interne qui transforme une simple liste de références en
          <strong>dossier produit complet</strong> (désignations, descriptifs, photos, prix),
          prêt à être réinjecté dans une IA générative comme Claude ou ChatGPT.
        </td></tr>

        <tr><td style="padding:12px 40px 4px;">
          <span style="display:inline-block;background:#eef2ff;color:${BRAND};font-size:12px;font-weight:600;padding:6px 12px;border-radius:999px;">
            Rôle attribué : ${roleLabel}
          </span>
        </td></tr>

        ${perso}

        <!-- CTA -->
        <tr><td align="center" style="padding:26px 40px 14px;">
          <a href="${cta}" target="_blank"
             style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 30px;border-radius:12px;">
            Activer mon accès
          </a>
        </td></tr>
        <tr><td align="center" style="padding:0 40px 26px;color:#64748b;font-size:12px;line-height:1.5;">
          Si le bouton ne fonctionne pas, copiez ce lien :<br>
          <a href="${cta}" style="color:${BRAND};word-break:break-all;">${cta}</a>
        </td></tr>

        <!-- Étapes -->
        <tr><td style="padding:0 40px 30px;">
          <div style="border-top:1px solid #e9edf4;padding-top:20px;color:#475569;font-size:13px;line-height:1.7;">
            <strong style="color:#0f172a;">Une fois connecté·e, en 3 étapes :</strong><br>
            1️⃣ Importez vos références (liste, Excel ou photo)<br>
            2️⃣ Laissez l'IA enrichir chaque produit<br>
            3️⃣ Récupérez le dossier complet pour votre IA générative
          </div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:18px 40px;color:#94a3b8;font-size:11px;line-height:1.5;border-top:1px solid #eef2f7;">
          Vous recevez cet e-mail car ${safeInviter || 'un administrateur'} vous a invité·e sur CatalogIA.
          Si vous pensez qu'il s'agit d'une erreur, ignorez simplement ce message.
        </td></tr>

      </table>
      <div style="color:#94a3b8;font-size:11px;margin-top:16px;">© ${new Date().getFullYear()} CatalogIA — Outil interne d'enrichissement de catalogues</div>
    </td></tr>
  </table>
</body></html>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 });
    if (user.role !== 'admin') {
      return Response.json({ error: 'Seuls les administrateurs peuvent inviter des utilisateurs.' }, { status: 403 });
    }

    const { email, role, appUrl, inviterName, personalMessage } = await req.json();

    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return Response.json({ error: 'Adresse e-mail invalide.' }, { status: 400 });
    }
    const cleanRole = role === 'admin' ? 'admin' : 'user';

    const html = buildEmail({
      appUrl: String(appUrl || '').trim(),
      inviterName: inviterName || user.full_name || user.email,
      role: cleanRole,
      personalMessage: personalMessage || ''
    });

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: cleanEmail,
      subject: '✨ Vous êtes invité·e à rejoindre CatalogIA',
      body: html,
      from_name: 'CatalogIA'
    });

    return Response.json({ success: true, email: cleanEmail, role: cleanRole });
  } catch (error) {
    return Response.json({ error: error.message || 'Échec de l\'envoi de l\'invitation' }, { status: 500 });
  }
});
