import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Upload, ClipboardPaste, FileSpreadsheet, ArrowRight, Loader2, Zap, AlertTriangle, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from 'xlsx';

export default function ImportZone({ onImport, isLoading }) {
  const [rawText, setRawText] = useState('');
  const [importName, setImportName] = useState('');
  const [activeTab, setActiveTab] = useState('paste');
  const [xlsxRows, setXlsxRows] = useState(null); // rows parsées depuis XLSX mailing
  const [xlsxFileName, setXlsxFileName] = useState('');
  const fileInputRef = useRef(null);

  // Détecte et parse le format MAILINGRDV : PAGE X + colonnes N°/REFERENCE/DESIGNATION/PRIX/COMMENTAIRE
  const parseMailingXlsx = (workbook) => {
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    const rows = [];
    for (const row of raw) {
      if (!row || row.length < 2) continue;
      // Ignore les lignes d'en-tête (PAGE X, REFERENCE, etc.)
      const first = String(row[0] || '').trim();
      const second = String(row[1] || '').trim();
      if (!first || first.toLowerCase().startsWith('page')) continue;
      if (second.toLowerCase() === 'reference' || second.toLowerCase() === 'référence') continue;
      // Ligne valide : premier champ = numéro (entier), second = référence
      const num = parseInt(first, 10);
      if (isNaN(num)) continue;
      const reference = second;
      if (!reference) continue;
      // Cherche désignation dans les colonnes (col index 2 à 6)
      let designation = '';
      for (let i = 2; i <= 6; i++) {
        if (row[i] && String(row[i]).trim()) { designation = String(row[i]).trim(); break; }
      }
      // Prix : col index 7 ou 8
      let prix = null;
      for (let i = 7; i <= 9; i++) {
        if (row[i] !== null && row[i] !== undefined && row[i] !== '') {
          const p = parseFloat(String(row[i]).replace(',', '.'));
          if (!isNaN(p)) { prix = p; break; }
        }
      }
      // Commentaire : col 10+
      let commentaire = '';
      for (let i = 10; i < row.length; i++) {
        if (row[i] && String(row[i]).trim()) { commentaire = String(row[i]).trim(); break; }
      }
      rows.push({ numero: num, reference, designation, prix, commentaire });
    }
    return rows;
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const rows = parseMailingXlsx(workbook);
      if (rows.length > 0) {
        setXlsxRows(rows);
        setXlsxFileName(file.name);
        if (!importName) setImportName(file.name.replace(/\.[^.]+$/, ''));
        return;
      }
    }
    // Fallback texte
    const text = await file.text();
    setRawText(text);
    setXlsxRows(null);
    setActiveTab('paste');
  };

  const handlePaste = async () => {
    const text = await navigator.clipboard.readText();
    setRawText(text);
  };

  const lineCount = xlsxRows ? xlsxRows.length : rawText.split('\n').filter(l => l.trim()).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-3xl mx-auto"
    >
      <Card className="overflow-hidden border-0 shadow-xl bg-card">
        {/* Tab selector */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('paste')}
            className={`flex-1 flex items-center justify-center gap-2 py-4 px-6 text-sm font-medium transition-all ${
              activeTab === 'paste'
                ? 'text-primary border-b-2 border-primary bg-primary/5'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ClipboardPaste className="w-4 h-4" />
            Coller ma liste
          </button>
          <button
            onClick={() => setActiveTab('file')}
            className={`flex-1 flex items-center justify-center gap-2 py-4 px-6 text-sm font-medium transition-all ${
              activeTab === 'file'
                ? 'text-primary border-b-2 border-primary bg-primary/5'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Importer un fichier
          </button>
        </div>

        <div className="p-6">
          {/* Nom de l'import */}
          <div className="mb-5 space-y-1.5">
            <label className="text-sm font-medium text-foreground">Nom de l'import <span className="text-muted-foreground font-normal">(facultatif)</span></label>
            <input
              type="text"
              value={importName}
              onChange={e => setImportName(e.target.value)}
              placeholder={`Import du ${new Date().toLocaleDateString('fr-FR')}`}
              className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {activeTab === 'paste' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Collez votre liste de produits ci-dessous — un produit par ligne
                </p>
                <Button variant="ghost" size="sm" onClick={handlePaste} className="text-xs">
                  <ClipboardPaste className="w-3 h-3 mr-1" />
                  Coller depuis le presse-papier
                </Button>
              </div>
              <Textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={"DUB184Z souffleur Makita  157€ HT  Prix barré 140€ ht\n1975709 pack batteries    330€ HT Prix barré 230€ ht\nDGP180Z pompe a graisse  319€ HT Prix barré 268€ ht"}
                className="min-h-[240px] font-mono text-sm resize-y bg-muted/50 border-border"
              />
              {rawText && (
                <p className="text-xs text-muted-foreground">
                  {lineCount} produit{lineCount > 1 ? 's' : ''} détecté{lineCount > 1 ? 's' : ''}
                </p>
              )}
            </div>
          ) : xlsxRows ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-emerald-800 text-sm">{xlsxFileName}</p>
                  <p className="text-xs text-emerald-600">{xlsxRows.length} produits détectés au format MAILING</p>
                </div>
                <button
                  onClick={() => { setXlsxRows(null); setXlsxFileName(''); fileInputRef.current.value = ''; }}
                  className="text-xs text-emerald-700 underline hover:no-underline"
                >Changer</button>
              </div>
              {/* Aperçu du tableau */}
              <div className="rounded-lg border border-border overflow-hidden text-xs">
                <div className="grid grid-cols-[32px_100px_1fr_70px] bg-muted font-semibold">
                  <div className="p-2 text-center border-r border-border">N°</div>
                  <div className="p-2 border-r border-border">Référence</div>
                  <div className="p-2 border-r border-border">Désignation</div>
                  <div className="p-2 text-right">Prix HT</div>
                </div>
                {xlsxRows.slice(0, 6).map((r, i) => (
                  <div key={i} className={`grid grid-cols-[32px_100px_1fr_70px] ${i % 2 === 0 ? '' : 'bg-muted/40'}`}>
                    <div className="p-2 text-center text-muted-foreground border-r border-border">{r.numero}</div>
                    <div className="p-2 font-mono text-primary border-r border-border truncate">{r.reference}</div>
                    <div className="p-2 border-r border-border truncate">{r.designation || <span className="text-muted-foreground italic">—</span>}</div>
                    <div className="p-2 text-right font-semibold">{r.prix != null ? `${r.prix} €` : '—'}</div>
                  </div>
                ))}
                {xlsxRows.length > 6 && (
                  <div className="p-2 text-center text-muted-foreground bg-muted/20">
                    + {xlsxRows.length - 6} autres produits…
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls,.txt" onChange={handleFileUpload} className="hidden" />
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
            >
              <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="font-medium text-foreground mb-1">
                Cliquez ou glissez votre fichier ici
              </p>
              <p className="text-sm text-muted-foreground">
                Formats acceptés : .csv, .xlsx, .txt
              </p>
              <p className="text-xs text-muted-foreground mt-1 text-primary/70">✓ Format MAILING (N° | Référence | Désignation | Prix HT) détecté automatiquement</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          )}

          <AnimatePresence>
            {lineCount > 0 && !isLoading && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm"
              >
                <Zap className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-amber-800">
                  <span className="font-semibold">{lineCount} crédit{lineCount > 1 ? 's' : ''} IA</span> seront consommés pour enrichir {lineCount} produit{lineCount > 1 ? 's' : ''}.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-4 flex justify-end">
            <Button
              size="lg"
              disabled={(!rawText.trim() && !xlsxRows) || isLoading}
              onClick={() => onImport(rawText, importName, xlsxRows)}
              className="gap-2 px-8 shadow-lg shadow-primary/25"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyse en cours...
                </>
              ) : (
                <>
                  Analyser mes produits
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}