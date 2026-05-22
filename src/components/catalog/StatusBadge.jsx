import React from 'react';
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, HelpCircle, XCircle } from "lucide-react";

const statusConfig = {
  'Validé': { 
    icon: CheckCircle2, 
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
  },
  'Validé partiel': { 
    icon: AlertTriangle, 
    className: 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100' 
  },
  'À vérifier': { 
    icon: HelpCircle, 
    className: 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100' 
  },
  'Introuvable': { 
    icon: XCircle, 
    className: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-100' 
  }
};

export default function StatusBadge({ status }) {
  const config = statusConfig[status] || statusConfig['À vérifier'];
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={`gap-1 font-medium ${config.className}`}>
      <Icon className="w-3 h-3" />
      {status}
    </Badge>
  );
}