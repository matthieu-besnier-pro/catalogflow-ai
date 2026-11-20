import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Sparkles, ArrowRight, ArrowLeft, UploadCloud, Wand2, CheckCircle2, FileDown,
  ClipboardPaste, FileSpreadsheet, ImageIcon, ShieldCheck, Image as ImageLucide,
  Tag, Zap, HelpCircle
} from "lucide-react";

const STEPS = [
  {
    icon: UploadCloud,
    color: "from-blue-500 to-indigo-500",
    title: "1 · Importer vos références",
    desc: "Partez de ce que vous avez déjà, aucun formatage requis.",
    points: [
      { icon: ClipboardPaste, text: "Coller une liste (une référence par ligne)" },
      { icon: FileSpreadsheet, text: "Importer un fichier Excel / CSV (formats Agrizone & MAILING reconnus)" },
      { icon: ImageIcon, text: "Importer une photo de catalogue — l'IA lit le tableau (OCR)" },
    ],
  },
  {
    icon: Wand2,
    color: "from-violet-500 to-purple-500",
    title: "2 · Enrichissement automatique",
    desc: "Pour chaque produit, l'IA recherche les informations sur internet.",
    points: [
      { icon: Tag, text: "Désignation commerciale, descriptif, marque et catégorie" },
      { icon: ImageLucide, text: "Photo officielle du produit, vérifiée pour éviter les visuels hors-sujet" },
      { icon: Zap, text: "Un niveau de confiance est attribué à chaque fiche" },
    ],
  },
  {
    icon: CheckCircle2,
    color: "from-emerald-500 to-teal-500",
    title: "3 · Vérifier & corriger",
    desc: "Vous gardez la main : rien n'est publié sans votre validation.",
    points: [
      { icon: ShieldCheck, text: "Repérez en un coup d'œil les fiches « À vérifier »" },
      { icon: Wand2, text: "Corrigez un champ, ou relancez l'enrichissement d'un produit" },
      { icon: ImageLucide, text: "Remplacez une image qui ne convient pas" },
    ],
  },
  {
    icon: FileDown,
    color: "from-orange-500 to-amber-500",
    title: "4 · Exporter le catalogue",
    desc: "Un fichier prêt à l'emploi, sans ressaisie.",
    points: [
      { icon: FileDown, text: "Export CSV / Excel du catalogue enrichi" },
      { icon: ArrowRight, text: "Envoi direct vers CAT'AGRI" },
      { icon: CheckCircle2, text: "Historique de tous vos imports, réutilisables" },
    ],
  },
];

const FAQ = [
  {
    q: "Dois-je préparer mon fichier d'une façon particulière ?",
    a: "Non. Collez votre liste, déposez votre Excel ou même une capture d'écran. L'outil détecte automatiquement les références, désignations et prix.",
  },
  {
    q: "Est-ce que l'IA peut se tromper d'image ou d'info ?",
    a: "Cela peut arriver. C'est pourquoi chaque fiche affiche un statut et un niveau de confiance, et pourquoi l'étape de vérification existe. Les visuels sont contrôlés automatiquement pour écarter les images sans rapport.",
  },
  {
    q: "Combien de temps pour un catalogue ?",
    a: "Quelques minutes pour l'enrichissement de dizaines de produits, puis le temps de relecture que vous souhaitez y consacrer.",
  },
  {
    q: "Mes imports sont-ils conservés ?",
    a: "Oui, chaque import est enregistré dans « Mes imports » et reste consultable et modifiable.",
  },
];

export default function Presentation() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">CatalogIA</span>
          </button>
          <button
            onClick={() => navigate("/")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" /> Retour à l'accueil
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6">
        {/* Hero */}
        <section className="py-14 md:py-20 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-medium px-3 py-1.5 rounded-full mb-6">
              <Sparkles className="w-3 h-3" />
              Guide de prise en main
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-foreground">
              CatalogIA, en 2 minutes
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Un outil interne qui transforme une simple liste de références en catalogue
              professionnel enrichi (désignations, descriptifs, photos, prix) — prêt à exporter.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" className="gap-2 px-7 shadow-lg shadow-primary/25" onClick={() => navigate("/")}>
                Démarrer un import <ArrowRight className="w-4 h-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/history")}>
                Voir les imports existants
              </Button>
            </div>
          </motion.div>
        </section>

        {/* Pour qui / pourquoi */}
        <section className="pb-6">
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { k: "Avant", v: "Des heures à chercher photos, descriptifs et prix, référence par référence." },
              { k: "Avec CatalogIA", v: "L'IA fait la recherche, vous ne faites que vérifier et valider." },
              { k: "Résultat", v: "Un catalogue homogène et pro, exporté en quelques clics." },
            ].map((c, i) => (
              <motion.div
                key={c.k}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.08 }}
                className="bg-card rounded-xl border border-border p-5"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-1">{c.k}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{c.v}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Étapes */}
        <section className="py-10">
          <h2 className="text-2xl font-bold text-foreground mb-8 text-center">Comment ça marche</h2>
          <div className="space-y-5">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ delay: i * 0.05 }}
                className="bg-card rounded-2xl border border-border p-6 md:p-7 flex flex-col md:flex-row gap-6"
              >
                <div className="md:w-64 shrink-0">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-3 shadow-sm`}>
                    <step.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-lg text-foreground">{step.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{step.desc}</p>
                </div>
                <ul className="flex-1 space-y-3 md:border-l md:border-border md:pl-6">
                  {step.points.map((p) => (
                    <li key={p.text} className="flex items-start gap-3">
                      <div className="shrink-0 w-7 h-7 rounded-lg bg-muted flex items-center justify-center mt-0.5">
                        <p.icon className="w-4 h-4 text-foreground/70" />
                      </div>
                      <span className="text-sm text-foreground leading-relaxed">{p.text}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Statuts expliqués */}
        <section className="py-6">
          <div className="bg-card rounded-2xl border border-border p-6 md:p-7">
            <h2 className="text-xl font-bold text-foreground mb-4">Comprendre les statuts</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { label: "Validé", cls: "bg-emerald-100 text-emerald-700", desc: "Fiche complète et fiable." },
                { label: "Validé partiel", cls: "bg-amber-100 text-amber-700", desc: "Informations trouvées mais à confirmer (ex. image)." },
                { label: "À vérifier", cls: "bg-slate-100 text-slate-700", desc: "Doute : une relecture est recommandée." },
                { label: "Introuvable", cls: "bg-red-100 text-red-700", desc: "Produit non identifié — à compléter à la main." },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${s.cls}`}>{s.label}</span>
                  <span className="text-sm text-muted-foreground">{s.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-8">
          <h2 className="text-2xl font-bold text-foreground mb-6 text-center">Questions fréquentes</h2>
          <div className="space-y-3 max-w-3xl mx-auto">
            {FAQ.map((item) => (
              <div key={item.q} className="bg-card rounded-xl border border-border p-5">
                <p className="font-semibold text-foreground flex items-start gap-2">
                  <HelpCircle className="w-4 h-4 text-primary mt-1 shrink-0" />
                  {item.q}
                </p>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed pl-6">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA final */}
        <section className="pb-20">
          <div className="rounded-2xl bg-gradient-to-br from-primary to-[hsl(225,73%,40%)] text-primary-foreground p-8 md:p-10 text-center">
            <h2 className="text-2xl md:text-3xl font-extrabold">Prêt à créer votre premier catalogue ?</h2>
            <p className="mt-2 text-primary-foreground/80 max-w-xl mx-auto">
              Lancez un import avec une poignée de références pour voir le résultat.
            </p>
            <Button
              size="lg"
              variant="secondary"
              className="mt-6 gap-2 px-7"
              onClick={() => navigate("/")}
            >
              Démarrer maintenant <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
