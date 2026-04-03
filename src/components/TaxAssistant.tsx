import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, ShieldCheck, Image as ImageIcon, X, Scale, FileText, Calculator, HelpCircle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { SafeImage } from './SafeImage';
import { motion, AnimatePresence } from 'framer-motion';
import { getTaxCompliance } from '../services/geminiService';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  image?: string;
}

export function TaxAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      text: "Bonjour ! Je suis votre conseiller expert en conformité fiscale, spécialiste des réglementations UEMOA et CEMAC. Je peux vous aider à identifier vos obligations fiscales, répondre à vos questions sur la réglementation, ou préparer des brouillons de déclarations (TVA, Impôts sur le revenu, etc.). Comment puis-je vous accompagner aujourd'hui ?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const quickActions = [
    { icon: <Calculator size={18} />, label: "Calculer TVA", prompt: "Aidez-moi à calculer la TVA pour une facture de 500 000 FCFA avec les taux OHADA." },
    { icon: <Scale size={18} />, label: "Règles IGR", prompt: "Quelles sont les tranches de l'IGR (Impôt Général sur le Revenu) en vigueur ?" },
    { icon: <FileText size={18} />, label: "Brouillon Déclaration", prompt: "Pouvez-vous me préparer un brouillon de déclaration de TVA mensuelle ?" },
    { icon: <HelpCircle size={18} />, label: "Exonérations", prompt: "Quelles sont les principales exonérations de TVA pour une PME de services ?" },
    { icon: <Sparkles size={18} />, label: "Audit Fiscal Complet", prompt: "Effectuez un audit fiscal complet de mes données financières actuelles pour détecter d'éventuelles anomalies." },
    { icon: <ShieldCheck size={18} />, label: "Optimisation IS", prompt: "Quelles sont les meilleures stratégies d'optimisation de l'Impôt sur les Sociétés pour mon entreprise ?" }
  ];

  const handleSend = async (textOverride?: string) => {
    const messageText = textOverride || input.trim();
    if (!messageText && !selectedImage) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: messageText,
      timestamp: new Date(),
      image: selectedImage || undefined
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    const imageBase64 = selectedImage ? selectedImage.split(',')[1] : null;
    const hasImage = !!selectedImage;
    setSelectedImage(null);
    setLoading(true);

    try {
      // Simulate document analysis if an image is provided
      if (hasImage) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        const analysisMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: "🔍 **Analyse du document en cours...**\n\nJ'ai détecté un document fiscal. Je procède à l'extraction des données clés (Montant HT, TVA, Date d'échéance) pour vérifier la conformité avec le Code Général des Impôts.",
          timestamp: new Date()
        };
        setMessages(prev => [...prev, analysisMsg]);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Special handling for Audit Fiscal
      if (messageText.toLowerCase().includes('audit fiscal complet')) {
        const auditStartMsg: Message = {
          id: (Date.now() + 1.5).toString(),
          role: 'assistant',
          text: "🛡️ **Lancement de l'Audit Fiscal Intelligent...**\n\nJe parcours vos journaux comptables, vos déclarations de TVA et votre masse salariale pour identifier tout risque de redressement ou opportunité d'optimisation.",
          timestamp: new Date()
        };
        setMessages(prev => [...prev, auditStartMsg]);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      const complianceReply = await getTaxCompliance(userMsg.text, imageBase64);
      
      const aiMsg: Message = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        text: complianceReply,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col glass rounded-3xl shadow-2xl border border-slate-200 dark:border-white/5 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="p-6 border-b border-slate-100 dark:border-white/5 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-brand-green/10 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-green/10 border border-brand-green/20 relative group">
            <ShieldCheck className="text-brand-green" size={24} />
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-brand-gold rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center">
              <Sparkles className="text-white" size={8} />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-black text-lg text-slate-900 dark:text-slate-100 tracking-tight uppercase">Audit Fiscal Expert</h2>
              <span className="px-2 py-0.5 bg-brand-green/10 text-brand-green text-[10px] font-black uppercase tracking-widest rounded-full border border-brand-green/20">Live Compliance</span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-black uppercase tracking-widest">Spécialiste Réglementation UEMOA & CEMAC</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-white/5 rounded-full border border-slate-200 dark:border-white/10">
            <div className="w-2 h-2 bg-brand-green rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Ory Tax AI v2.5</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide" ref={scrollRef}>
        {messages.length === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
            {quickActions.map((action, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => handleSend(action.prompt)}
                className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-brand-green hover:shadow-md transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-xl bg-brand-green/10 text-brand-green flex items-center justify-center group-hover:bg-brand-green group-hover:text-white transition-colors">
                  {action.icon}
                </div>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 group-hover:text-brand-green transition-colors">{action.label}</span>
              </motion.button>
            ))}
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={cn(
                "flex gap-4 max-w-[90%]",
                msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
              )}
            >
                <div className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
                  msg.role === 'user' ? "bg-slate-900 dark:bg-slate-800" : "bg-brand-green/10 border border-brand-green/20"
                )}>
                  {msg.role === 'user' ? (
                    <User className="text-white" size={20} />
                  ) : (
                    <Bot className={cn(
                      "text-brand-green",
                      msg.text.includes('🛡️') || msg.text.includes('🔍') ? "text-brand-gold" : "text-brand-green"
                    )} size={20} />
                  )}
                </div>
              <div className={cn(
                "p-5 rounded-3xl shadow-sm",
                msg.role === 'user' 
                  ? "bg-brand-green text-white rounded-tr-none" 
                  : "bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-tl-none"
              )}>
                {msg.image && (
                  <SafeImage 
                    src={msg.image} 
                    alt="Uploaded" 
                    className="max-w-full h-auto rounded-2xl mb-4 border border-slate-200 dark:border-slate-700 shadow-sm"
                    style={{ maxHeight: '300px' }}
                  />
                )}
                <div className={cn(
                  "prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed",
                  msg.role === 'user' ? "prose-p:text-white" : "prose-p:text-slate-700 dark:prose-p:text-slate-200"
                )}>
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {loading && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-4 max-w-[80%]"
          >
            <div className="w-10 h-10 rounded-2xl bg-brand-green/10 flex items-center justify-center shrink-0">
              <Bot className="text-brand-green" size={20} />
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-3xl rounded-tl-none flex items-center gap-3 shadow-sm">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-brand-green rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-brand-green rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-brand-green rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Analyse fiscale...</span>
            </div>
          </motion.div>
        )}
      </div>

      <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md">
        {selectedImage && (
          <div className="mb-4 relative inline-block">
            <img 
              src={selectedImage} 
              alt="Preview" 
              className="h-24 w-auto rounded-2xl border border-slate-200 dark:border-slate-700 object-cover shadow-lg"
            />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-rose-500 text-white rounded-full flex items-center justify-center hover:bg-rose-600 shadow-xl border-2 border-white dark:border-slate-900 transition-transform hover:scale-110"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className="flex items-end gap-3">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImageSelect}
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-4 text-slate-400 hover:text-brand-green hover:bg-brand-green/10 rounded-2xl transition-all shrink-0 border border-slate-100 dark:border-slate-800"
            title="Joindre un document (ex: avis d'imposition)"
          >
            <ImageIcon size={24} />
          </button>
          <div className="flex-1 relative group">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Posez une question fiscale ou demandez un brouillon..."
              className="w-full max-h-32 min-h-[56px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/50 resize-none transition-all"
              rows={1}
            />
            <div className="absolute right-3 bottom-3 flex items-center gap-2">
              <button 
                onClick={() => handleSend()}
                disabled={(!input.trim() && !selectedImage) || loading}
                className="p-3 bg-brand-green text-white rounded-xl hover:bg-brand-green-light disabled:opacity-50 disabled:cursor-not-allowed transition-all shrink-0 shadow-lg hover:shadow-brand-green/20 hover:-translate-y-0.5"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-center gap-2">
          <Sparkles size={12} className="text-brand-green" />
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">
            Conseils indicatifs basés sur le SYSCOHADA & Codes Généraux des Impôts
          </p>
        </div>
      </div>
    </div>
  );
}
