import React from 'react';
import { Badge } from "@/components/ui/badge";

const confidenceConfig = {
  'Élevé': 'bg-emerald-50 text-emerald-600 border-emerald-200',
  'Moyen': 'bg-amber-50 text-amber-600 border-amber-200',
  'Faible': 'bg-red-50 text-red-600 border-red-200'
};

export default function ConfidenceBadge({ level }) {
  if (!level) return <span className="text-xs text-muted-foreground">—</span>;
  const cls = confidenceConfig[level] || confidenceConfig['Faible'];

  return (
    <Badge variant="outline" className={`text-xs font-medium ${cls}`}>
      {level}
    </Badge>
  );
}