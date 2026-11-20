import React from "react";
import { Sparkles, UploadCloud, Wand2, Bot } from "lucide-react";

const FEATURES = [
  { icon: UploadCloud, title: "Import flexible", desc: "Collez une liste, un fichier Excel ou une photo de catalogue." },
  { icon: Wand2, title: "Enrichissement IA", desc: "Désignation, descriptif, photo, marque et prix trouvés automatiquement." },
  { icon: Bot, title: "Dossier prêt pour l'IA", desc: "Un dossier complet à réinjecter dans Claude ou ChatGPT." },
];

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr] bg-background">
      {/* ── Panneau de marque (gauche) ── */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-primary to-[hsl(225,73%,40%)] text-primary-foreground p-12 xl:p-16">
        {/* Décor */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 -left-20 w-80 h-80 rounded-full bg-black/10 blur-3xl" />
        </div>

        {/* Logo */}
        <div className="relative flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="font-bold text-xl tracking-tight">CatalogIA</span>
        </div>

        {/* Accroche + features */}
        <div className="relative max-w-md">
          <h2 className="text-3xl xl:text-4xl font-extrabold leading-tight tracking-tight">
            Vos listes produits,<br />transformées en catalogue pro.
          </h2>
          <p className="mt-4 text-primary-foreground/80 text-base leading-relaxed">
            L'IA recherche les informations et les visuels de chaque référence, vous validez, puis vous exportez.
          </p>

          <ul className="mt-10 space-y-5">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex items-start gap-4">
                <div className="shrink-0 w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/20">
                  <f.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold">{f.title}</p>
                  <p className="text-sm text-primary-foreground/75 leading-snug">{f.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} CatalogIA — Outil interne d'enrichissement de catalogues.
        </p>
      </aside>

      {/* ── Formulaire (droite) ── */}
      <main className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
          {/* Logo compact (mobile uniquement) */}
          <div className="flex items-center justify-center gap-2.5 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl tracking-tight text-foreground">CatalogIA</span>
          </div>

          <div className="text-center mb-8">
            {Icon && (
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 text-primary mb-4">
                <Icon className="w-7 h-7" aria-hidden="true" />
              </div>
            )}
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{title}</h1>
            {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
          </div>

          <div className="bg-card rounded-2xl shadow-sm border border-border p-6 sm:p-8">
            {children}
          </div>

          {footer && (
            <p className="text-center text-sm text-muted-foreground mt-6">{footer}</p>
          )}
        </div>
      </main>
    </div>
  );
}
