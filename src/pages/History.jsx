import React from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Package, Clock, ChevronRight, Loader2 } from "lucide-react";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { motion } from 'framer-motion';

export default function History() {
  const navigate = useNavigate();

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ['batches'],
    queryFn: () => base44.entities.CatalogBatch.list('-created_date', 50)
  });

  const statusLabels = {
    en_cours: { label: 'En cours', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    termine: { label: 'Terminé', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    erreur: { label: 'Erreur', cls: 'bg-red-100 text-red-700 border-red-200' }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="font-bold text-lg">Historique des imports</h1>
          </div>
          <Button onClick={() => navigate('/')} className="gap-2">
            <Plus className="w-4 h-4" />
            Nouvel import
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : batches.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Aucun import pour le moment</p>
            <p className="text-sm text-muted-foreground mb-6">
              Commencez par importer votre première liste de produits
            </p>
            <Button onClick={() => navigate('/')} className="gap-2">
              <Plus className="w-4 h-4" />
              Importer des produits
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {batches.map((batch, i) => {
              const status = statusLabels[batch.status] || statusLabels.en_cours;
              return (
                <motion.div
                  key={batch.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card
                    className="p-4 cursor-pointer hover:shadow-md transition-all border-border hover:border-primary/30"
                    onClick={() => navigate(`/catalog/${batch.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-semibold truncate">{batch.name}</h3>
                          <Badge variant="outline" className={status.cls}>
                            {status.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Package className="w-3 h-3" />
                            {batch.total_products || 0} produits
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {batch.created_date
                              ? format(new Date(batch.created_date), 'dd MMM yyyy à HH:mm', { locale: fr })
                              : '—'}
                          </span>
                          {batch.processed_products > 0 && (
                            <span>
                              {batch.processed_products}/{batch.total_products} enrichis
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}