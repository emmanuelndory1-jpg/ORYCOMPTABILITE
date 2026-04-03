import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MessageSquareText, X, Send, Loader2, Sparkles, Maximize2, Minimize2, Camera, Image as ImageIcon, Paperclip, Trash2, ChevronRight, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenAI } from "@google/genai";
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  image?: string;
}

export function FloatingAdvisor() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Bonjour ! Je suis votre conseiller OryCompta. Comment puis-je vous aider avec votre comptabilité aujourd\'hui ?' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const location = useLocation();

  const suggestions = useMemo(() => {
    const defaultSuggestions = ["Expliquer la TVA OHADA", "Aide saisie facture", "Règles d'amortissement"];
    const path = location.pathname;

    if (path === '/') return ["Analyser mon CA", "Audit de santé", "Prévision trésorerie", ...defaultSuggestions];
    if (path.includes('journal')) return ["Aide imputation", "Vérifier pièce jointe", "Écritures types", ...defaultSuggestions];
    if (path.includes('payroll')) return ["Calculer IGR", "Cotisations CNPS", "Prime transport", ...defaultSuggestions];
    if (path.includes('vat')) return ["Déclaration TVA", "TVA déductible", "Exonérations", ...defaultSuggestions];
    if (path.includes('treasury')) return ["Rapprochement bancaire", "Flux de trésorerie", "Soldes", ...defaultSuggestions];
    
    return defaultSuggestions;
  }, [location.pathname]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

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

  const handleSend = async (textOverride?: string) => {
    const messageText = textOverride || input.trim();
    if (!messageText && !selectedImage) return;
    if (isLoading) return;

    const userMessage: Message = { 
      role: 'user', 
      content: messageText,
      image: selectedImage || undefined
    };

    setInput('');
    const currentImage = selectedImage;
    setSelectedImage(null);
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const parts: any[] = [{ text: `Tu es le conseiller intelligent d'ORYCOMPTABILITE, une solution comptable pour l'espace OHADA. L'utilisateur s'appelle ${user?.name || 'Utilisateur'}. Réponds de manière professionnelle, concise et aidante. Si l'utilisateur pose une question sur sa comptabilité, explique-lui les concepts OHADA si nécessaire. Voici sa question : ${messageText}` }];
      
      if (currentImage) {
        const base64Data = currentImage.split(',')[1];
        const mimeType = currentImage.split(';')[0].split(':')[1];
        parts.push({
          inlineData: {
            data: base64Data,
            mimeType: mimeType
          }
        });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: 'user', parts }],
        config: {
          systemInstruction: "Tu es un expert comptable spécialisé dans le système OHADA. Tu aides les entrepreneurs à gérer leur comptabilité sur la plateforme OryCompta. Sois précis, utilise un ton professionnel mais accessible. Utilise le format Markdown pour tes réponses (gras, listes, tableaux si nécessaire)."
        }
      });

      const text = response.text || "Désolé, je n'ai pas pu générer de réponse.";
      setMessages(prev => [...prev, { role: 'assistant', content: text }]);
    } catch (error) {
      console.error('AI Error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Désolé, j'ai rencontré une erreur technique. Veuillez réessayer plus tard." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-24 md:bottom-8 right-4 md:right-8 z-30 flex flex-col items-end gap-4">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20, transformOrigin: 'bottom right' }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={cn(
              "bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden transition-all duration-300",
              isExpanded ? "w-[90vw] h-[80vh] md:w-[600px] md:h-[700px]" : "w-[350px] h-[500px]"
            )}
          >
            {/* Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-green flex items-center justify-center shadow-lg shadow-brand-green/20">
                  <Sparkles size={20} className="text-brand-gold" />
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-none mb-1">Conseiller Ory</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse" />
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Expert en ligne</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"
                >
                  {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-900/50">
              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "max-w-[85%] p-4 rounded-2xl text-sm shadow-sm",
                    msg.role === 'user' 
                      ? "bg-brand-green text-white ml-auto rounded-tr-none" 
                      : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 mr-auto rounded-tl-none border border-slate-100 dark:border-slate-700"
                  )}
                >
                  {msg.image && (
                    <img 
                      src={msg.image} 
                      alt="Uploaded" 
                      className="w-full max-h-48 object-cover rounded-xl mb-3 border border-white/20 shadow-sm" 
                    />
                  )}
                  <div className={cn(
                    "prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed",
                    msg.role === 'user' ? "prose-p:text-white" : "prose-p:text-slate-700 dark:prose-p:text-slate-200"
                  )}>
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </motion.div>
              ))}
              {isLoading && (
                <div className="flex items-center gap-3 text-slate-400 text-xs font-medium bg-white/50 dark:bg-slate-800/50 p-3 rounded-2xl w-fit border border-slate-100 dark:border-slate-700">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-brand-green rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-brand-green rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-brand-green rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  Ory réfléchit...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggestions */}
            {!isLoading && (
              <div className="px-4 py-3 flex flex-wrap gap-2 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                {suggestions.slice(0, 4).map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(s)}
                    className="text-[9px] font-black uppercase tracking-widest bg-slate-50 dark:bg-slate-800 hover:bg-brand-green/10 hover:text-brand-green text-slate-500 dark:text-slate-400 px-3 py-2 rounded-xl transition-all border border-slate-100 dark:border-slate-700 hover:border-brand-green/30"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="p-4 bg-white border-t border-slate-100">
              {selectedImage && (
                <div className="mb-3 relative inline-block">
                  <img src={selectedImage} alt="Preview" className="w-16 h-16 object-cover rounded-lg border-2 border-brand-green" />
                  <button 
                    onClick={() => setSelectedImage(null)}
                    className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1 shadow-lg"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
              <div className="relative flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-slate-400 hover:text-brand-green hover:bg-slate-100 rounded-xl transition-all"
                  title="Joindre une image"
                >
                  <ImageIcon size={20} />
                </button>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Posez votre question..."
                  className="flex-1 bg-slate-100 border-transparent focus:bg-white focus:border-brand-green focus:ring-4 focus:ring-brand-green/10 rounded-xl py-3 px-4 text-sm transition-all outline-none"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={isLoading || (!input.trim() && !selectedImage)}
                  className="p-3 bg-brand-green text-white rounded-xl hover:bg-brand-green-light disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-brand-green/20 active:scale-95"
                >
                  <Send size={18} />
                </button>
              </div>
              <p className="text-[9px] text-slate-400 text-center mt-3 uppercase tracking-widest font-bold">
                Expertise OHADA • Support Intelligent
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-300",
          isOpen 
            ? "bg-slate-900 text-white rotate-90" 
            : "bg-brand-green text-white hover:bg-brand-green-light shadow-brand-green/30"
        )}
      >
        {isOpen ? <X size={28} /> : <MessageSquareText size={28} />}
        {!isOpen && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white animate-bounce">
            1
          </span>
        )}
      </motion.button>
    </div>
  );
}
