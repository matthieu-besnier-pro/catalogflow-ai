import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Download, RefreshCw, ChevronLeft, ChevronRight, Printer } from "lucide-react";
import CatagriToolbar from '@/components/catagri/CatagriToolbar';
import CatagriPageView from '@/components/catagri/CatagriPageView';

function buildProject(products, batchName, opts = {}) {
  const density = opts.density || 16;
  return {
    v: '9',
    products: products.map((p, idx) => ({
      _id: p.id || ('p_' + idx),
      ordre: idx + 1,
      page: String(Math.floor(idx / density) + 1),
      famille: p.categorie || '',
      refF: p.reference || '',
      nom: p.designation || p.intitule_origine || '',
      desc: p.petit_descriptif || '',
      photo: p.photo_url || '',
      prix: p.tarif_promo_ht != null ? String(p.tarif_promo_ht).replace('.', ',') : '',
      prixA: p.tarif_normal_ht != null ? String(p.tarif_normal_ht).replace('.', ',') : '',
      format: 'normal',
      badge: '',
      dispo: '',
      featured: false,
    })),
    encarts: [],
    cover: {
      title: batchName || 'Catalogue',
      sub: new Date().getFullYear().toString(),
      img: '', backTitle: '', backInfo: '', backImg: ''
    },
    filiale: opts.filiale || null,
    format: 'a4p',
    density,
    template: opts.template || 'catalogue',
    mode: 'catalogue',
    cols: opts.cols || 4,
    priceStyle: 'bandeau',
  };
}

export default function CatagriEditor() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const batchId = searchParams.get('batchId');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [batchName, setBatchName] = useState('');
  const [rawProducts, setRawProducts] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);

  // Paramètres de mise en page
  const [opts, setOpts] = useState({
    template: 'catalogue',
    filiale: 'none',
    density: 16,
    cols: 4,
  });

  useEffect(() => {
    if (!batchId) { setLoading(false); return; }
    (async () => {
      try {
        const [batches, products] = await Promise.all([
          base44.entities.CatalogBatch.filter({ id: batchId }),
          base44.entities.Product.filter({ batch_id: batchId }),
        ]);
        setBatchName(batches[0]?.name || 'Catalogue');
        setRawProducts(products);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [batchId]);

  const projet = buildProject(rawProducts, batchName, {
    ...opts,
    filiale: opts.filiale === 'none' ? null : opts.filiale,
  });

  const totalPages = Math.max(1, Math.ceil(rawProducts.length / opts.density));
  const pageProducts = projet.products.filter(p => p.page === String(currentPage));

  // Reset page quand density change
  useEffect(() => { setCurrentPage(1); }, [opts.density]);

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(projet, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `catagri_${batchName || 'catalogue'}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    // Sync localStorage pour CAT'AGRI externe
    localStorage.setItem('cf9', JSON.stringify(projet));
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center h-screen gap-2 text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin" />
      Chargement…
    </div>
  );

  if (error) return (
    <div className="flex-1 flex items-center justify-center h-screen text-destructive text-sm">
      Erreur : {error}
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(batchId ? `/catalog/${batchId}` : '/')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="font-bold text-sm leading-none">CAT'AGRI Studio</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{batchName || 'Mode autonome'} · {rawProducts.length} produits</p>
          </div>
          <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">BETA</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Pagination */}
          <div className="flex items-center gap-1 border border-border rounded-lg px-2 py-1">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-0.5 disabled:opacity-30 hover:text-primary">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium px-2">Page {currentPage} / {totalPages}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-0.5 disabled:opacity-30 hover:text-primary">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={handleExportJSON} className="gap-2">
            <Download className="w-3.5 h-3.5" />
            Exporter .json
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Panneau gauche : paramètres */}
        <aside className="w-64 border-r border-border bg-card shrink-0 overflow-y-auto">
          <CatagriToolbar opts={opts} onChange={setOpts} productCount={rawProducts.length} />
        </aside>

        {/* Zone aperçu */}
        <main className="flex-1 overflow-auto bg-muted/40 p-6 flex flex-col items-center">
          <CatagriPageView
            products={pageProducts}
            opts={opts}
            coverData={projet.cover}
            isFirstPage={currentPage === 1}
          />
        </main>
      </div>
    </div>
  );
}