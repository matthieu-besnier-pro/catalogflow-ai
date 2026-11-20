import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { action, userId, role } = await req.json().catch(() => ({}));

    if (action === 'updateRole') {
      if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 });
      if (role !== 'user' && role !== 'admin') return Response.json({ error: 'Invalid role' }, { status: 400 });
      if (userId === user.id) return Response.json({ error: 'Vous ne pouvez pas modifier votre propre rôle.' }, { status: 400 });
      const updated = await base44.asServiceRole.entities.User.update(userId, { role });
      return Response.json({ ok: true, id: updated.id, role: updated.role });
    }

    const users = await base44.asServiceRole.entities.User.list('-created_date', 200);
    const list = users.map((u) => ({
      id: u.id,
      full_name: u.full_name || '',
      email: u.email || '',
      role: u.role || 'user',
      created_date: u.created_date || null,
    }));
    return Response.json({ users: list });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}