import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Upload, ClipboardPaste, FileSpreadsheet, ArrowRight, Loader2, Zap, AlertTriangle, CheckCircle2, ImageIcon, ScanLine } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as XLSX from 'xlsx';
import { base44 } from '@/api/base44Client';

export default function ImportZone({ onImport, isLoading }) {
  const [rawText, setRawText] = useState('');
  const [importName, setImportName] = useState('');
  const [activeTab, setActiveTab] = useState('paste');
  const [parsedRows, setParsedRows] = useState(null); // rows parsées (XLSX ou image)
  const [parsedFileName, setParsedFileName] = useState('');
  const [parsedSource, setParsedSource] = useState(null); // 'xlsx' | 'image'
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const fileInputRef = useRef(null);

  // Parse le format Agrizone : colonnes Référence Agrizone (AGZ…) | code fab | Désignation | Prix HT | Prix TTC | Commentaires
  // Ignore les lignes d'en-tête et de catégorie (ex : « Tout pour votre tracteur »).
  const parseAgrizoneXlsx = (workbook) => {
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    const toNum = (v) => {
      if (v === null || v === undefined || v === '') return null;
      const p = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
      return isNaN(p) ? null : p;
    };
    const rows = [];
    let n = 0;
    for (const row of raw) {
      if (!row || row.length === 0) continue;
      const ref = String(row[0] ?? '').trim();
      if (!ref) continue;
      // Seules les lignes dont la 1re colonne est une référence Agrizone (AGZ…) sont des produits
      if (!/^AGZ/i.test(ref)) continue;
      const designation = String(row[2] ?? '').trim();
      const prixHt = toNum(row[3]);
      const prixTtc = toNum(row[4]);
      const commentaire = String(row[5] ?? '').trim();
      n += 1;
      rows.push({
        numero: n,
        reference: ref,
        designation,
        prix_ht: prixHt,
        prix_ttc: prixTtc,
        prix: prixHt, // rétro-compat : prix principal = HT
        commentaire
      });
    }
    return rows;
  };

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
      // Essaie d'abord le format Agrizone, puis le format MAILING
      let rows = parseAgrizoneXlsx(workbook);
      let source = 'agrizone';
      if (rows.length === 0) {
        rows = parseMailingXlsx(workbook);
        source = 'xlsx';
      }
      if (rows.length > 0) {
        setParsedRows(rows);
        setParsedFileName(file.name);
        setParsedSource(source);
        if (!importName) setImportName(file.name.replace(/\.[^.]+$/, ''));
        return;
      }
    }

    // Image → OCR via IA vision
    if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name)) {
      setIsOcrLoading(true);
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        const res = await base44.integrations.Core.InvokeLLM({
          prompt: `Tu es un assistant OCR spécialisé dans l'extraction de catalogues produits. Analyse cette image qui contient un tableau/liste de produits. Pour CHAQUE produit visible, extrais :
- "reference" : le code/SKU produit (souvent préfixé par une marque abrégée comme LUB, PBL, PPK, SOD, BAR, UKA, AIG, KLI, etc.)
- "designation" : le texte descriptif du produit
- "prix" : le prix HT en nombre (virgule = décimale, ex: "11,72" → 11.72)

Retourne TOUS les produits visibles sur l'image, sans en oublier aucun. Si une colonne prix est absente pour un produit, mets prix à null.`,
          file_urls: [file_url],
          response_json_schema: {
            type: "object",
            properties: {
              products: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    reference: { type: "string" },
                    designation: { type: "string" },
                    prix: { type: "number" }
                  }
                }
              }
            }
          }
        });
        const rows = (res.products || []).map((p, i) => ({
          numero: i + 1,
          reference: String(p.reference || '').trim(),
          designation: String(p.designation || '').trim(),
          prix: p.prix != null ? Number(p.prix) : null,
          commentaire: ''
        })).filter(r => r.reference);
        if (rows.length > 0) {
          setParsedRows(rows);
          setParsedFileName(file.name);
          setParsedSource('image');
          if (!importName) setImportName(file.name.replace(/\.[^.]+$/, ''));
        } else {
          alert('Aucun produit détecté sur cette image. Essayez une image plus nette.');
        }
      } catch (err) {
        console.error('OCR error:', err);
        alert(`Erreur lors de la lecture de l'image : ${err.message}`);
      } finally {
        setIsOcrLoading(false);
      }
      return;
    }

    // Fallback texte
    const text = await file.text();
    setRawText(text);
    setParsedRows(null);
    setActiveTab('paste');
  };

  const handlePaste = async () => {
    const text = await navigator.clipboard.readText();
    setRawText(text);
  };

  const lineCount = parsedRows ? parsedRows.length : rawText.split('\n').filter(l => l.trim()).length;

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
          ) : isOcrLoading ? (
            <div className="border-2 border-dashed border-primary/40 rounded-xl p-12 text-center bg-primary/5">
              <ScanLine className="w-12 h-12 mx-auto text-primary mb-4 animate-pulse" />
              <p className="font-medium text-foreground mb-1">
                Lecture de l'image en cours…
              </p>
              <p className="text-sm text-muted-foreground">
                L'IA analyse votre capture d'écran pour extraire les produits
              </p>
              <Loader2 className="w-5 h-5 mx-auto mt-4 animate-spin text-primary" />
            </div>
          ) : parsedRows ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold text-emerald-800 text-sm">{parsedFileName}</p>
                  <p className="text-xs text-emerald-600">
                    {parsedRows.length} produits détectés {parsedSource === 'image' ? 'depuis l\'image' : parsedSource === 'agrizone' ? 'au format Agrizone' : 'au format MAILING'}
                  </p>
                </div>
                <button
                  onClick={() => { setParsedRows(null); setParsedFileName(''); setParsedSource(null); fileInputRef.current.value = ''; }}
                  className="text-xs text-emerald-700 underline hover:no-underline"
                >Changer</button>
              </div>
              {/* Aperçu du tableau */}
              <div className="rounded-lg border border-border overflow-hidden text-xs">
                <div className={`grid ${parsedSource === 'image' ? 'grid-cols-[100px_1fr_70px]' : 'grid-cols-[32px_100px_1fr_70px]'} bg-muted font-semibold`}>
                  {parsedSource !== 'image' && <div className="p-2 text-center border-r border-border">N°</div>}
                  <div className="p-2 border-r border-border">Référence</div>
                  <div className="p-2 border-r border-border">Désignation</div>
                  <div className="p-2 text-right">Prix HT</div>
                </div>
                {parsedRows.slice(0, 6).map((r, i) => (
                  <div key={i} className={`grid ${parsedSource === 'image' ? 'grid-cols-[100px_1fr_70px]' : 'grid-cols-[32px_100px_1fr_70px]'} ${i % 2 === 0 ? '' : 'bg-muted/40'}`}>
                    {parsedSource !== 'image' && <div className="p-2 text-center text-muted-foreground border-r border-border">{r.numero}</div>}
                    <div className="p-2 font-mono text-primary border-r border-border truncate">{r.reference}</div>
                    <div className="p-2 border-r border-border truncate">{r.designation || <span className="text-muted-foreground italic">—</span>}</div>
                    <div className="p-2 text-right font-semibold">{r.prix != null ? `${r.prix} €` : '—'}</div>
                  </div>
                ))}
                {parsedRows.length > 6 && (
                  <div className="p-2 text-center text-muted-foreground bg-muted/20">
                    + {parsedRows.length - 6} autres produits…
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls,.txt,image/*" onChange={handleFileUpload} className="hidden" />
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
                Formats acceptés : .csv, .xlsx, .txt, images (.png, .jpg)
              </p>
              <p className="text-xs text-muted-foreground mt-1 text-primary/70">✓ Format MAILING et captures d'écran détectés automatiquement</p>
              <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><FileSpreadsheet className="w-3 h-3" /> Excel/CSV</span>
                <span className="flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Image (OCR IA)</span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.txt,image/*"
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
              disabled={(!rawText.trim() && !parsedRows) || isLoading || isOcrLoading}
              onClick={() => onImport(rawText, importName, parsedRows)}
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