import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import ImportZone from '../components/import/ImportZone';
import { Sparkles, ArrowRight, Package, Zap, Shield } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleImport = async (rawText) => {
    setIsLoading(true);
    try {
      const batch = await base44.entities.CatalogBatch.create({
        name: `Import du ${new Date().toLocaleDateString('fr-FR')}`,
        status: 'en_cours',
        raw_input: rawText
      });

      await base44.functions.invoke('parseProducts', {
        rawText,
        batchId: batch.id
      });

      navigate(`/catalog/${batch.id}`);
    } catch (err) {
      console.error(err);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">CatalogIA</span>
          </div>
          <button
            onClick={() => navigate('/history')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Mes imports
          </button>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-6xl mx-auto px-6">
        <div className="py-16 md:py-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-medium px-3 py-1.5 rounded-full mb-6">
              <Sparkles className="w-3 h-3" />
              Enrichissement IA automatique
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-foreground">
              Transformez votre liste produits<br />
              <span className="text-primary">en catalogue professionnel</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-12">
              Collez vos références, l'IA recherche les informations sur internet
              et génère un fichier prêt à importer dans votre solution catalogue.
            </p>
          </motion.div>

          <ImportZone onImport={handleImport} isLoading={isLoading} />
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 pb-20">
          {[
            {
              icon: Package,
              title: 'Import flexible',
              desc: 'Collez du texte brut ou importez un fichier CSV. L\'outil détecte automatiquement les références et prix.'
            },
            {
              icon: Zap,
              title: 'Enrichissement intelligent',
              desc: 'L\'IA recherche désignation, descriptif, photo, marque et catégorie sur internet pour chaque produit.'
            },
            {
              icon: Shield,
              title: 'Validation & Export',
              desc: 'Vérifiez, corrigez manuellement si besoin, puis exportez un fichier CSV prêt pour votre catalogue.'
            }
          ].map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="bg-card rounded-xl border border-border p-6 text-left"
            >
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
}