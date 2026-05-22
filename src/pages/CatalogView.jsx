import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, Loader2, X } from "lucide-react";
import ProductTable from '../components/catalog/ProductTable';
import ProductEditDialog from '../components/catalog/ProductEditDialog';
import EnrichmentProgress from '../components/catalog/EnrichmentProgress';
import ExportDialog from '../components/catalog/ExportDialog';
import ExportToCatagri from '../components/catalog/ExportToCatagri';

export default function CatalogView() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editProduct, setEditProduct] = useState(null);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichingId, setEnrichingId] = useState(null);
  const [enrichProgress, setEnrichProgress] = useState({ current: 0, total: 0, currentName: '' });
  const cancelEnrichRef = useRef(false);

  const { data: batch } = useQuery({
    queryKey: ['batch', batchId],
    queryFn: () => base44.entities.CatalogBatch.filter({ id: batchId }).then(r => r[0]),
    enabled: !!batchId
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', batchId],
    queryFn: () => base44.entities.Product.filter({ batch_id: batchId }),
    enabled: !!batchId
  });

  const enrichAll = useCallback(async () => {
    const toEnrich = products.filter(p => !p.enriched);
    if (toEnrich.length === 0) return;

    cancelEnrichRef.current = false;
    setIsEnriching(true);
    setEnrichProgress({ current: 0, total: toEnrich.length, currentName: '' });

    for (let i = 0; i < toEnrich.length; i++) {
      if (cancelEnrichRef.current) break;

      const product = toEnrich[i];
      setEnrichingId(product.id);
      setEnrichProgress({
        current: i,
        total: toEnrich.length,
        currentName: `${product.reference} ${product.intitule_origine || ''}`
      });

      try {
        await base44.functions.invoke('enrichProduct', { productId: product.id });
      } catch (err) {
        console.error(`Erreur enrichissement ${product.reference}:`, err);
      }

      queryClient.invalidateQueries({ queryKey: ['products', batchId] });
    }

    setEnrichProgress(prev => ({ ...prev, current: toEnrich.length }));
    setIsEnriching(false);
    setEnrichingId(null);
    cancelEnrichRef.current = false;
    queryClient.invalidateQueries({ queryKey: ['batch', batchId] });
  }, [products, batchId, queryClient]);

  const handleSaveProduct = async (updatedProduct, keepOpen = false) => {
    const { id, created_date, updated_date, created_by, ...data } = updatedProduct;
    await base44.entities.Product.update(id, data);
    await queryClient.refetchQueries({ queryKey: ['products', batchId] });
    if (!keepOpen) setEditProduct(null);
  };

  const handleDeleteProduct = async (productId) => {
    await base44.entities.Product.delete(productId);
    queryClient.invalidateQueries({ queryKey: ['products', batchId] });
  };

  const handleReenrichProduct = async (productId) => {
    setEnrichingId(productId);
    try {
      await base44.functions.invoke('enrichProduct', { productId });
    } catch (err) {
      console.error('Erreur re-enrichissement:', err);
    }
    await queryClient.refetchQueries({ queryKey: ['products', batchId] });
    queryClient.invalidateQueries({ queryKey: ['batch', batchId] });
    setEnrichingId(null);
    setEditProduct(null);
  };

  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showCatagriExport, setShowCatagriExport] = useState(false);
  const unenrichedCount = products.filter(p => !p.enriched).length;
  const hasEnrichedProducts = products.some(p => p.enriched);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="font-bold text-lg">{batch?.name || 'Catalogue'}</h1>
              <p className="text-xs text-muted-foreground">
                {products.length} produit{products.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isEnriching && (
              <Button
                variant="outline"
                onClick={() => { cancelEnrichRef.current = true; }}
                className="gap-2 border-destructive/50 text-destructive hover:bg-destructive/5"
              >
                <X className="w-4 h-4" />
                Annuler
              </Button>
            )}
            {unenrichedCount > 0 && (
              <Button
                onClick={enrichAll}
                disabled={isEnriching}
                className="gap-2 shadow-lg shadow-primary/20"
              >
                {isEnriching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {isEnriching
                  ? 'Enrichissement...'
                  : `Enrichir ${unenrichedCount} produit${unenrichedCount > 1 ? 's' : ''}`
                }
              </Button>
            )}
            {hasEnrichedProducts && !isEnriching && (
              <button
                onClick={() => setShowCatagriExport(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-amber-500 text-white text-sm font-medium shadow-lg hover:bg-amber-600 transition-colors"
              >
                🎨 Ouvrir dans CAT'AGRI
              </button>
            )}
            {hasEnrichedProducts && !isEnriching && (
              <button
                onClick={() => setShowExportDialog(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Exporter (.xlsx + images)
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Progress */}
        {isEnriching && (
          <EnrichmentProgress
            current={enrichProgress.current}
            total={enrichProgress.total}
            currentProduct={enrichProgress.currentName}
          />
        )}

        {/* Stats summary */}
        {hasEnrichedProducts && !isEnriching && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Validés', count: products.filter(p => p.statut_validation === 'Validé').length, color: 'text-emerald-600 bg-emerald-50' },
              { label: 'Partiels', count: products.filter(p => p.statut_validation === 'Validé partiel').length, color: 'text-amber-600 bg-amber-50' },
              { label: 'À vérifier', count: products.filter(p => p.statut_validation === 'À vérifier').length, color: 'text-orange-600 bg-orange-50' },
              { label: 'Introuvables', count: products.filter(p => p.statut_validation === 'Introuvable').length, color: 'text-red-600 bg-red-50' }
            ].map((stat) => (
              <div key={stat.label} className={`rounded-xl px-4 py-3 ${stat.color}`}>
                <p className="text-2xl font-bold">{stat.count}</p>
                <p className="text-xs font-medium opacity-80">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <ProductTable
            products={products}
            onEdit={setEditProduct}
            onDelete={handleDeleteProduct}
            enrichingId={enrichingId}
          />
        )}
      </main>

      {/* Edit dialog */}
      <ProductEditDialog
        product={editProduct}
        open={!!editProduct}
        onClose={() => setEditProduct(null)}
        onSave={handleSaveProduct}
        onReenrich={handleReenrichProduct}
      />

      {/* CAT'AGRI export */}
      <ExportToCatagri
        open={showCatagriExport}
        onClose={() => setShowCatagriExport(false)}
        products={products}
        batchName={batch?.name}
      />

      {/* Export dialog */}
      <ExportDialog
        open={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        products={products}
        batchId={batchId}
        batchName={batch?.name}
      />
    </div>
  );
}