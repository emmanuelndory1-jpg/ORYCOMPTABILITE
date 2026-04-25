import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, ShieldCheck, TrendingUp, Scale, Zap, ChevronRight, MessageSquare, Info, Trash2 } from 'lucide-react';
import { apiFetch as fetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { currency } = useCurrency();
  const { activeYear } = useFiscalYear();

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
    <div className="h-[calc(100vh-2rem)] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors duration-300">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center gap-3">
        <div className="w-10 h-10 bg-brand-green/10 rounded-full flex items-center justify-center">
          <Sparkles className="text-brand-green" size={20} />
        </div>
        <div>
          <h2 className="font-bold text-slate-900 dark:text-slate-100">Conseiller Expert Ory</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Spécialiste SYSCOHADA & Fiscalité</p>
        </div>
        <button 
          onClick={handleClearChat}
          className="ml-auto p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-rose-500"
          title="Effacer la conversation"
        >
          <Trash2 size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/50" ref={scrollRef}>
        {messages.length === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            {quickActions.map((action, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => handleSend(action.prompt)}
                className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-brand-green hover:shadow-md transition-all text-left group"
              >
                <div className="w-10 h-10 rounded-xl bg-brand-green/10 text-brand-green flex items-center justify-center group-hover:bg-brand-green group-hover:text-white transition-colors">
                  <action.icon size={20} />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-0.5">{action.label}</p>
                  <p className="text-[10px] text-slate-500 line-clamp-1">{action.prompt}</p>
                </div>
                <ChevronRight size={14} className="ml-auto text-slate-300 group-hover:text-brand-green transition-colors" />
              </motion.button>
            ))}
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={cn(
                "flex gap-3 max-w-[80%]",
                msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                msg.role === 'user' ? "bg-slate-200 dark:bg-slate-800" : "bg-brand-green"
              )}>
                {msg.role === 'user' ? <User size={16} className="text-slate-600 dark:text-slate-400" /> : <Bot size={16} className="text-white" />}
              </div>
              <div className={cn(
                "p-4 rounded-2xl text-sm leading-relaxed shadow-sm",
                msg.role === 'user' 
                  ? "bg-brand-green text-white rounded-tr-none" 
                  : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-100 dark:border-slate-700"
              )}>
                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-slate-900 prose-pre:text-slate-100">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
                <div className={cn(
                  "text-[10px] opacity-50 mt-2 flex items-center justify-end gap-1",
                  msg.role === 'user' ? "text-white/80" : "text-slate-400"
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
            className="flex gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-brand-green flex items-center justify-center flex-shrink-0">
              <Bot size={16} className="text-white" />
            </div>
            <div className="bg-brand-green/5 dark:bg-brand-green/10 p-4 rounded-2xl rounded-tl-none border border-brand-green/20 dark:border-brand-green/30 flex gap-1">
              <div className="w-2 h-2 bg-brand-green/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-brand-green/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-brand-green/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </motion.div>
        )}
      </div>

      <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Posez une question comptable..."
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green transition-all"
          />
          <button 
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="bg-brand-green hover:bg-brand-green-light disabled:opacity-50 disabled:cursor-not-allowed text-white p-3 rounded-xl transition-colors"
          >
            <Send size={20} />
          </button>
        </div>
        <div className="mt-2 text-center">
          <p className="text-[10px] text-slate-400">
            Les informations fournies par l'IA sont vérifiées via Google Search mais doivent être validées par un expert-comptable agréé.
          </p>
        </div>
      </div>
    </div>
  );
}
