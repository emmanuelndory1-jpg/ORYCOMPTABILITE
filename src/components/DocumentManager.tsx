import React, { useState } from 'react';
import { FileText, Upload, Folder, File, Search, Filter, MoreVertical, Download, Trash2, Tag, Calendar, FolderPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/context/LanguageContext';

interface Document {
  id: string;
  name: string;
  type: string;
  size: string;
  date: string;
  category: string;
  tags: string[];
}

const mockDocuments: Document[] = [
  { id: '1', name: 'Facture_F2024-001.pdf', type: 'application/pdf', size: '2.4 MB', date: '2024-05-15', category: 'Factures Clients', tags: ['Client A', 'Q2'] },
  { id: '2', name: 'Releve_Bancaire_Mai.pdf', type: 'application/pdf', size: '1.1 MB', date: '2024-05-01', category: 'Banque', tags: ['SGCI', 'Mai'] },
  { id: '3', name: 'Contrat_Prestation.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: '540 KB', date: '2024-04-20', category: 'Légal', tags: ['Contrat', 'Prestataire'] },
  { id: '4', name: 'Justificatif_Frais.jpg', type: 'image/jpeg', size: '3.2 MB', date: '2024-05-18', category: 'Notes de Frais', tags: ['Restaurant', 'Commercial'] },
  { id: '5', name: 'Bilan_2023.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: '4.8 MB', date: '2024-01-31', category: 'Déclarations', tags: ['Annuel', 'Validé'] },
];

const categories = ['Tous', 'Factures Clients', 'Factures Fournisseurs', 'Banque', 'Légal', 'Notes de Frais', 'Déclarations'];

export function DocumentManager() {
  const { t } = useLanguage();
  const [documents, setDocuments] = useState<Document[]>(mockDocuments);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('Tous');
  const [isUploading, setIsUploading] = useState(false);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return <FileText className="text-rose-500" />;
    if (type.includes('word')) return <FileText className="text-blue-500" />;
    if (type.includes('sheet') || type.includes('excel')) return <FileText className="text-emerald-500" />;
    if (type.includes('image')) return <FileText className="text-amber-500" />;
    return <File className="text-slate-500" />;
  };

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          doc.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = activeCategory === 'Tous' || doc.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFileUpload(e.target.files);
    }
  };

  const handleFileUpload = (files: FileList) => {
    setIsUploading(true);
    // Simulate upload delay
    setTimeout(() => {
      const newDocs: Document[] = Array.from(files).map((file, index) => ({
        id: `new-${Date.now()}-${index}`,
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
        date: new Date().toISOString().split('T')[0],
        category: 'Non classé',
        tags: ['Nouveau']
      }));
      setDocuments(prev => [...newDocs, ...prev]);
      setIsUploading(false);
    }, 1500);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Voulez-vous vraiment supprimer ce document ?')) {
      setDocuments(prev => prev.filter(d => d.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Folder className="text-brand-green" />
            Gestion Documentaire (GED)
          </h1>
          <p className="text-slate-500 text-sm font-medium">Stockez, organisez et retrouvez tous vos documents comptables.</p>
        </div>
      </div>

      {/* Upload Zone */}
      <div 
        className={cn(
          "w-full border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-all duration-300 group",
          isDragging 
            ? "border-brand-green bg-brand-green/5 scale-[1.01]" 
            : "border-slate-200 dark:border-slate-800 hover:border-brand-green/50 hover:bg-slate-50 dark:hover:bg-slate-900/50"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform">
          {isUploading ? (
            <div className="w-8 h-8 border-4 border-brand-green/30 border-t-brand-green rounded-full animate-spin" />
          ) : (
            <Upload className={cn("w-8 h-8", isDragging ? "text-brand-green" : "text-slate-400")} />
          )}
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
          {isUploading ? 'Importation en cours...' : 'Glissez-déposez vos fichiers ici'}
        </h3>
        <p className="text-slate-500 text-sm mb-6 text-center max-w-md">
          Supporte PDF, Word, Excel, Images. La taille maximale par fichier est de 50MB.
        </p>
        <label className="relative cursor-pointer">
          <input type="file" multiple className="sr-only" onChange={handleFileInput} />
          <span className="px-6 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold hover:bg-brand-green dark:hover:bg-brand-green hover:text-white transition-colors shadow-sm">
            Parcourir les fichiers
          </span>
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar/Categories */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
            <h3 className="font-bold text-xs uppercase tracking-widest text-slate-400 mb-4 px-2">Catégories</h3>
            <div className="space-y-1">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-bold transition-all",
                    activeCategory === cat
                      ? "bg-brand-green/10 text-brand-green"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  )}
                >
                  <span className="flex items-center gap-2">
                    {cat === 'Tous' ? <Folder size={16} /> : <FolderPlus size={16} />}
                    {cat}
                  </span>
                  <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800",
                    activeCategory === cat && "bg-brand-green/20"
                  )}>
                    {cat === 'Tous' ? documents.length : documents.filter(d => d.category === cat).length}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Document List */}
        <div className="lg:col-span-3 space-y-4">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Rechercher par nom ou tag..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green/50 text-sm font-medium"
              />
            </div>
            <button className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
              <Filter size={16} /> Filtres
            </button>
          </div>

          {/* List */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 gap-4 p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-xs font-black uppercase tracking-widest text-slate-500">
              <div className="col-span-8 md:col-span-4">Nom du fichier</div>
              <div className="col-span-4 hidden md:block">Catégorie</div>
              <div className="col-span-2 hidden md:block">Taille / Date</div>
              <div className="col-span-4 md:col-span-2 text-right">Actions</div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredDocs.length > 0 ? filteredDocs.map((doc) => (
                <div key={doc.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                  <div className="col-span-8 md:col-span-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 hidden md:flex">
                      {getFileIcon(doc.type)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-900 dark:text-white truncate" title={doc.name}>
                        {doc.name}
                      </p>
                      <div className="flex md:hidden items-center gap-2 mt-1">
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                           <Calendar size={12} /> {doc.date}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-brand-green/10 text-brand-green whitespace-nowrap">
                          {doc.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 md:mt-2">
                        {doc.tags.map(tag => (
                          <span key={tag} className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-md whitespace-nowrap">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="col-span-4 hidden md:flex items-center">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-brand-green/10 text-brand-green whitespace-nowrap">
                      {doc.category}
                    </span>
                  </div>

                  <div className="col-span-2 hidden md:flex flex-col">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{doc.size}</span>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Calendar size={12} /> {doc.date}
                    </span>
                  </div>

                  <div className="col-span-4 md:col-span-2 flex items-center justify-end gap-1">
                    <button className="p-2 text-slate-400 hover:text-brand-green hover:bg-brand-green/10 rounded-lg transition-colors" title="Télécharger">
                      <Download size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(doc.id)}
                      className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors" 
                      title="Supprimer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )) : (
                <div className="p-12 text-center text-slate-500">
                  <Folder className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
                  <p className="text-sm font-medium">Aucun document trouvé.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
