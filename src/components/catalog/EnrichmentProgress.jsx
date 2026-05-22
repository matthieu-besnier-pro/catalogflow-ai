import React from 'react';
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function EnrichmentProgress({ current, total, currentProduct }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  const isDone = current >= total && total > 0;

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
            {isDone ? 'Enrichissement terminé !' : 'Enrichissement en cours...'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {current} / {total} produit{total > 1 ? 's' : ''} traité{total > 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
          <Sparkles className="w-3.5 h-3.5" />
          {pct}%
        </div>
      </div>

      <Progress value={pct} className="h-2" />

      {currentProduct && !isDone && (
        <p className="text-xs text-muted-foreground mt-3 truncate">
          Recherche en cours : <span className="font-medium text-foreground">{currentProduct}</span>
        </p>
      )}
    </motion.div>
  );
}