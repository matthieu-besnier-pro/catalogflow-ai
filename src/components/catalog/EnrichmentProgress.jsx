import React, { useState, useEffect } from 'react';
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, Sparkles, Clock } from "lucide-react";
import { motion } from "framer-motion";

const TIPS = [
  "Recherche sur le site officiel de la marque...",
  "Analyse des distributeurs professionnels...",
  "Extraction de l'image produit optimale...",
  "Génération de la description commerciale...",
  "Vérification et validation des données...",
];

export default function EnrichmentProgress({ current, total, currentProduct }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  const isDone = current >= total && total > 0;
  const [elapsed, setElapsed] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    if (isDone) return;
    setElapsed(0);
    const timer = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(timer);
  }, [current, isDone]);

  useEffect(() => {
    if (isDone) return;
    const tipTimer = setInterval(() => setTipIndex(i => (i + 1) % TIPS.length), 4000);
    return () => clearInterval(tipTimer);
  }, [isDone]);

  const formatTime = (s) => s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${s % 60}s`;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl p-6 shadow-sm"
    >
      <div className="flex items-center gap-3 mb-4">
        {isDone ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        ) : (
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
        )}
        <div className="flex-1">
          <p className="font-semibold text-sm">
            {isDone ? 'Enrichissement terminé !' : 'Enrichissement IA en cours...'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {current} / {total} produit{total > 1 ? 's' : ''} traité{total > 1 ? 's' : ''}
            {!isDone && total > 0 && (
              <span className="ml-2 text-amber-600 font-medium">
                ~{Math.round((total - current) * 55)}s restantes
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isDone && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {formatTime(elapsed)}
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
            <Sparkles className="w-3.5 h-3.5" />
            {pct}%
          </div>
        </div>
      </div>

      <Progress value={pct} className="h-2" />

      {currentProduct && !isDone && (
        <div className="mt-3 space-y-1">
          <p className="text-xs text-muted-foreground truncate">
            Produit : <span className="font-medium text-foreground">{currentProduct}</span>
          </p>
          <motion.p
            key={tipIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-primary/70 italic"
          >
            ⏳ {TIPS[tipIndex]}
          </motion.p>
          <p className="text-xs text-muted-foreground/60">
            La recherche internet par IA prend environ 45-60s par produit — c'est normal.
          </p>
        </div>
      )}
    </motion.div>
  );
}