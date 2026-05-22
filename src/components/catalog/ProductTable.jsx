import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Pencil, AlertTriangle, Loader2 } from "lucide-react";
import StatusBadge from './StatusBadge';
import ConfidenceBadge from './ConfidenceBadge';

export default function ProductTable({ products, onEdit, enrichingId }) {
  if (!products || products.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        Aucun produit à afficher
      </div>
    );
  }

  const formatPrice = (price) => {
    if (price === null || price === undefined) return '—';
    return `${price.toFixed(2)} €`;
  };

  return (
    <TooltipProvider>
      <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold w-10">#</TableHead>
                <TableHead className="font-semibold">Réf.</TableHead>
                <TableHead className="font-semibold">Désignation</TableHead>
                <TableHead className="font-semibold">Photo</TableHead>
                <TableHead className="font-semibold text-right">Promo HT</TableHead>
                <TableHead className="font-semibold text-right">Normal HT</TableHead>
                <TableHead className="font-semibold">Marque</TableHead>
                <TableHead className="font-semibold">Confiance</TableHead>
                <TableHead className="font-semibold">Statut</TableHead>
                <TableHead className="font-semibold w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product, idx) => {
                const priceAlert = product.tarif_normal_ht && product.tarif_promo_ht && product.tarif_normal_ht < product.tarif_promo_ht;
                const isEnriching = enrichingId === product.id;

                return (
                  <TableRow
                    key={product.id}
                    className={`group transition-colors hover:bg-muted/30 ${
                      priceAlert ? 'bg-red-50/50' : ''
                    }`}
                  >
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {idx + 1}
                    </TableCell>
                    <TableCell className="font-mono text-sm font-medium">
                      {product.reference}
                    </TableCell>
                    <TableCell className="max-w-[240px]">
                      <div className="truncate text-sm font-medium">
                        {product.designation || product.intitule_origine || '—'}
                      </div>
                      {product.petit_descriptif && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="text-xs text-muted-foreground truncate mt-0.5 cursor-help">
                              {product.petit_descriptif}
                            </p>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-sm">
                            {product.petit_descriptif}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell>
                      {product.photo_url ? (
                        <img
                          src={product.photo_url}
                          alt=""
                          className="w-10 h-10 object-contain rounded border bg-white"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded border bg-muted flex items-center justify-center">
                          <span className="text-xs text-muted-foreground">—</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium text-sm">
                      {formatPrice(product.tarif_promo_ht)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      <div className="flex items-center justify-end gap-1">
                        {priceAlert && (
                          <Tooltip>
                            <TooltipTrigger>
                              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                            </TooltipTrigger>
                            <TooltipContent>
                              Prix barré inférieur au prix promo
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {formatPrice(product.tarif_normal_ht)}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {product.marque || '—'}
                    </TableCell>
                    <TableCell>
                      <ConfidenceBadge level={product.niveau_confiance} />
                    </TableCell>
                    <TableCell>
                      {isEnriching ? (
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      ) : (
                        <StatusBadge status={product.statut_validation} />
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => onEdit(product)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </TooltipProvider>
  );
}