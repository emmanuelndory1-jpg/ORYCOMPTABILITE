import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, ShieldCheck, TrendingUp, Scale, Zap, ChevronRight, MessageSquare, Info, Trash2, Maximize2, Minimize2, ExternalLink, Loader2 } from 'lucide-react';
import { apiFetch as fetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { askAssistant } from '../services/geminiService';
import { useAuth } from '@/context/AuthContext';
import { useCurrency } from '@/hooks/useCurrency';
import { useFiscalYear } from '@/context/FiscalYearContext';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

export function ExpertAdvisor() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      text: "Bonjour ! Je suis Ory, votre assistant intelligent spécialisé dans le système comptable SYSCOHADA. Je peux analyser vos données financières, vous aider avec vos déclarations fiscales ou auditer votre conformité. Que souhaitez-vous faire aujourd'hui ?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isWide, setIsWide] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { currency } = useCurrency();
  const { activeYear } = useFiscalYear();
  const navigate = useNavigate();

  const quickActions = [
    { label: "Audit Flash", icon: ShieldCheck, prompt: "Peux-tu faire un audit rapide de ma situation financière actuelle ?" },
    { label: "Analyse CA", icon: TrendingUp, prompt: "Analyse l'évolution de mon chiffre d'affaires sur les 6 derniers mois." },
    { label: "Conseil Fiscal", icon: Scale, prompt: "Quelles sont mes prochaines échéances fiscales importantes ?" },
    { label: "Optimisation", icon: Zap, prompt: "Comment puis-je optimiser mes charges d'exploitation ?" }
  ];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (textOverride?: string) => {
    const messageText = textOverride || input.trim();
    if (!messageText) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: messageText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.map(m => ({
        role: m.role === 'user' ? 'user' as const : 'assistant' as const,
        content: m.text
      }));

      const context = {
        userName: user?.name,
        userEmail: user?.email,
        currency: currency,
        fiscalYear: activeYear?.name,
        timestamp: new Date().toISOString()
      };

      const reply = await askAssistant(messageText, history, context);
      
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: reply || "Désolé, je n'ai pas pu traiter votre demande.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: '1',
        role: 'assistant',
        text: "Bonjour ! Je suis Ory, votre assistant intelligent spécialisé dans le système comptable SYSCOHADA. Je peux analyser vos données financières, vous aider avec vos déclarations fiscales ou auditer votre conformité. Que souhaitez-vous faire aujourd'hui ?",
        timestamp: new Date()
      }
    ]);
  };

  return (
    <div className={cn(
      "h-[calc(100vh-10rem)] flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden transition-all duration-500",
      isWide ? "max-w-6xl mx-auto ring-1 ring-slate-200 dark:ring-white/5" : "max-w-3xl mx-auto"
    )}>
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center gap-4 backdrop-blur-xl">
        <div className="w-12 h-12 bg-brand-green/10 rounded-2xl flex items-center justify-center shadow-inner">
          <Sparkles className="text-brand-green" size={24} />
        </div>
        <div>
          <h2 className="font-black text-slate-900 dark:text-slate-100 tracking-tight">Conseiller Expert Ory</h2>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Spécialiste SYSCOHADA & Fiscalité</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button 
            onClick={() => setIsWide(!isWide)}
            className="p-2.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-all text-slate-500 dark:text-slate-400 hover:text-brand-green active:scale-90"
            title={isWide ? "Réduire la largeur" : "Agrandir la largeur"}
          >
            {isWide ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
          <div className="w-px h-6 bg-slate-200 dark:bg-white/5 mx-1" />
          <button 
            onClick={handleClearChat}
            className="p-2.5 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all text-slate-400 hover:text-rose-500 active:scale-90"
            title="Effacer la conversation"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 bg-white dark:bg-slate-900 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800" ref={scrollRef}>
        {messages.length === 1 && (
          <div className="max-w-2xl mx-auto space-y-8 py-10">
            <div className="text-center space-y-3">
              <div className="inline-flex p-3 rounded-2xl bg-brand-green/5 text-brand-green font-bold text-xs uppercase tracking-widest border border-brand-green/10">
                Suggestions Intelligentes
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Comment puis-je vous assister ?</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {quickActions.map((action, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  onClick={() => handleSend(action.prompt)}
                  className="flex items-center gap-4 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-brand-green hover:bg-white dark:hover:bg-slate-800 hover:shadow-xl hover:shadow-brand-green/5 transition-all text-left group"
                >
                  <div className="w-12 h-12 rounded-xl bg-brand-green/10 text-brand-green flex items-center justify-center group-hover:bg-brand-green group-hover:text-white transition-all transform group-hover:scale-110 group-hover:rotate-3 shadow-sm">
                    <action.icon size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 group-hover:text-brand-green transition-colors">{action.label}</p>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400 line-clamp-1">{action.prompt}</p>
                  </div>
                  <ChevronRight size={18} className="ml-auto text-slate-300 group-hover:text-brand-green transition-all transform group-hover:translate-x-1" />
                </motion.button>
              ))}
            </div>
          </div>
        )}

        <div className="max-w-5xl mx-auto space-y-8">
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={msg.id || i}
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={cn(
                  "flex gap-4 group",
                  msg.role === 'user' ? "flex-row-reverse" : "items-start"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg transition-transform group-hover:scale-110",
                  msg.role === 'user' 
                    ? "bg-slate-900 text-white" 
                    : "bg-brand-green text-white"
                )}>
                  {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                </div>
                <div className={cn(
                  "space-y-2 max-w-[85%] md:max-w-[75%]",
                  msg.role === 'user' ? "items-end" : "items-start"
                )}>
                  <div className={cn(
                    "p-5 rounded-3xl text-sm leading-relaxed shadow-xl shadow-slate-200/20 dark:shadow-black/20",
                    msg.role === 'user' 
                      ? "bg-brand-green text-white rounded-tr-none" 
                      : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-100 dark:border-slate-800"
                  )}>
                    <div className={cn(
                      "prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-slate-950 prose-pre:text-slate-200 prose-pre:rounded-xl prose-pre:p-4 prose-code:text-brand-green dark:prose-code:text-brand-green-light",
                      msg.role === 'user' ? "prose-p:text-white" : ""
                    )}>
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                  </div>
                  <div className={cn(
                    "text-[10px] font-bold uppercase tracking-widest opacity-40 px-2",
                    msg.role === 'user' ? "text-right" : "text-left"
                  )}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {loading && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-4"
            >
              <div className="w-10 h-10 rounded-2xl bg-brand-green text-white flex items-center justify-center flex-shrink-0">
                <Bot size={20} />
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-3xl rounded-tl-none border border-slate-100 dark:border-slate-800 flex gap-1.5 shadow-sm">
                <div className="w-2 h-2 bg-brand-green/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-brand-green/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-brand-green/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Posez une question comptable..."
              className="flex-1 px-5 py-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green transition-all shadow-inner"
            />
            <button 
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              className="bg-brand-green hover:bg-brand-green-light disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 rounded-2xl transition-all shadow-lg shadow-brand-green/20 active:scale-95 flex items-center justify-center min-w-[60px]"
            >
              {loading ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} />}
            </button>
          </div>
          <div className="mt-4 flex items-center justify-center gap-6">
            <div className="flex items-center gap-2">
              <ShieldCheck size={12} className="text-brand-green" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">IA Sécurisée</p>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles size={12} className="text-brand-gold" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Conseils SYSCOHADA</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
