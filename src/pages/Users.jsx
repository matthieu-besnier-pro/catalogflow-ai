import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { ArrowLeft, Loader2, ShieldCheck, User as UserIcon, Mail, Lock, Users as UsersIcon, UserPlus, Send } from "lucide-react";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion } from 'framer-motion';

function initials(name, email) {
  const base = (name || email || '?').trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

export default function Users() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const [savingId, setSavingId] = useState(null);

  // Invitation
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim());

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviteError('');
    if (!emailValid) {
      setInviteError('Adresse e-mail invalide.');
      return;
    }
    setInviting(true);
    try {
      await base44.users.inviteUser(inviteEmail.trim(), inviteRole);
      toast({
        title: 'Invitation envoyée',
        description: `Un e-mail d'invitation a été envoyé à ${inviteEmail.trim()}.`,
      });
      setInviteOpen(false);
      setInviteEmail('');
      setInviteRole('user');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err) {
      const msg = String(err?.message || '');
      setInviteError(
        /already|existe|registered|member/i.test(msg)
          ? 'Cette adresse correspond déjà à un utilisateur de l\'application.'
          : "Échec de l'envoi de l'invitation. Vérifiez l'adresse et réessayez."
      );
    } finally {
      setInviting(false);
    }
  };

  const { data: users = [], isLoading, isError } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list('-created_date', 200)
  });

  const changeRole = async (u, nextRole) => {
    if (u.role === nextRole) return;
    setSavingId(u.id);
    try {
      await base44.entities.User.update(u.id, { role: nextRole });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err) {
      console.error('Maj rôle échouée:', err);
    } finally {
      setSavingId(null);
    }
  };

  const roleBadge = (role) => role === 'admin'
    ? 'bg-primary/10 text-primary border-primary/20'
    : 'bg-slate-100 text-slate-600 border-slate-200';

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="font-bold text-lg">Utilisateurs</h1>
          </div>
          <div className="flex items-center gap-3">
            {!isLoading && !isError && (
              <Badge variant="outline" className="gap-1.5">
                <UsersIcon className="w-3.5 h-3.5" />
                {users.length} membre{users.length > 1 ? 's' : ''}
              </Badge>
            )}
            {isAdmin && (
              <Button className="gap-2" onClick={() => setInviteOpen(true)}>
                <UserPlus className="w-4 h-4" />
                Inviter
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Bandeau rôle courant */}
        <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-muted/40 border border-border">
          <ShieldCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "Vous êtes administrateur : vous pouvez changer le rôle des membres. Les administrateurs ont accès à la gestion des utilisateurs."
              : "Vous consultez la liste des membres. Seuls les administrateurs peuvent modifier les rôles."}
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : isError ? (
          <div className="text-center py-20">
            <Lock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Accès restreint</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              La liste des utilisateurs n'est pas accessible avec votre compte. Demandez à un
              administrateur de vous donner les droits nécessaires.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((u, i) => {
              const isSelf = u.id === currentUser?.id;
              const isSaving = savingId === u.id;
              return (
                <motion.div
                  key={u.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Card className="p-4 border-border">
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm shrink-0">
                        {initials(u.full_name, u.email)}
                      </div>

                      {/* Infos */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold truncate">
                            {u.full_name || u.email || 'Utilisateur'}
                          </p>
                          {isSelf && (
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              vous
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-0.5">
                          {u.email && (
                            <span className="flex items-center gap-1 truncate">
                              <Mail className="w-3 h-3" /> {u.email}
                            </span>
                          )}
                          {u.created_date && !isNaN(new Date(u.created_date).getTime()) && (
                            <span>
                              Ajouté le {format(new Date(u.created_date), 'dd MMM yyyy', { locale: fr })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Rôle */}
                      <div className="shrink-0">
                        {isAdmin && !isSelf ? (
                          isSaving ? (
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          ) : (
                            <select
                              value={u.role || 'user'}
                              onChange={(e) => changeRole(u, e.target.value)}
                              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
                              aria-label={`Rôle de ${u.full_name || u.email}`}
                            >
                              <option value="user">Utilisateur</option>
                              <option value="admin">Administrateur</option>
                            </select>
                          )
                        ) : (
                          <Badge variant="outline" className={roleBadge(u.role)}>
                            {u.role === 'admin' ? (
                              <><ShieldCheck className="w-3 h-3 mr-1" /> Administrateur</>
                            ) : (
                              <><UserIcon className="w-3 h-3 mr-1" /> Utilisateur</>
                            )}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>

      {/* Fenêtre d'invitation */}
      <Dialog open={inviteOpen} onOpenChange={(o) => { if (!inviting) setInviteOpen(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <UserPlus className="w-5 h-5" />
              </span>
              Inviter un utilisateur
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleInvite} className="space-y-4 pt-1">
            <p className="text-sm text-muted-foreground">
              La personne recevra un e-mail d'invitation avec un lien pour activer son accès à CatalogFlow AI.
            </p>

            {inviteError && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{inviteError}</div>
            )}

            <div className="space-y-2">
              <Label htmlFor="invite-email">Adresse e-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="invite-email"
                  type="email"
                  autoFocus
                  placeholder="collegue@entreprise.fr"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="pl-10 h-11"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-role">Rôle</Label>
              <select
                id="invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full h-11 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
              >
                <option value="user">Utilisateur</option>
                <option value="admin">Administrateur</option>
              </select>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)} disabled={inviting}>
                Annuler
              </Button>
              <Button type="submit" className="gap-2" disabled={inviting || !emailValid}>
                {inviting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Envoi…</>
                ) : (
                  <><Send className="w-4 h-4" /> Envoyer l'invitation</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}