import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";

const CATAGRI_URL = 'https://media.base44.com/files/public/6a10177b7a3ac967742fe243/76734be2a_CatalogueGONNIN.html';

// Mapping CatalogIA → CAT'AGRI
function buildCatagriProject(products, batchName, options = {}) {
  const density = options.density || 16;
  const catagriProducts = products.map((p, idx) => ({
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
  }));

  return {
    v: '9',
    products: catagriProducts,
    encarts: [],
    cover: {
      title: batchName || 'Catalogue',
      sub: new Date().getFullYear().toString(),
      img: '', backTitle: '', backInfo: '', backImg: ''
    },
    filiale: options.filiale || null,
    format: 'a4p',
    density,
    template: options.template || 'catalogue',
    mode: 'catalogue',
    cols: options.cols || 4,
    priceStyle: 'bandeau',
  };
}

export default function CatagriEditor() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const batchId = searchParams.get('batchId');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const iframeRef = useRef(null);

  useEffect(() => {
    if (!batchId) { setReady(true); return; }

    (async () => {
      try {
        const [batches, products] = await Promise.all([
          base44.entities.CatalogBatch.filter({ id: batchId }),
          base44.entities.Product.filter({ batch_id: batchId }),
        ]);
        const batch = batches[0];
        const projet = buildCatagriProject(products, batch?.name);
        // Injecter dans localStorage avant que l'iframe charge
        localStorage.setItem('cf9', JSON.stringify(projet));
        setReady(true);
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [batchId]);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Mini header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-card shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate(batchId ? `/catalog/${batchId}` : '/')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <span className="font-semibold text-sm">CAT'AGRI — Mise en page</span>
        <span className="text-xs text-muted-foreground ml-1">
          {batchId ? '✓ Données chargées depuis CatalogIA' : 'Mode autonome'}
        </span>
      </div>

      {/* Contenu */}
      {error ? (
        <div className="flex-1 flex items-center justify-center text-destructive text-sm">
          Erreur : {error}
        </div>
      ) : !ready ? (
        <div className="flex-1 flex items-center justify-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="w-5 h-5 animate-spin" />
          Chargement des données…
        </div>
      ) : (
        <iframe
          ref={iframeRef}
          src={CATAGRI_URL}
          className="flex-1 w-full border-0"
          title="CAT'AGRI"
        />
      )}
    </div>
  );
}