import React, { useState } from 'react';
import { Logo } from './Logo';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, Loader2, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { signInWithGoogle } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { SafeImage } from './SafeImage';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const firebaseUser = await signInWithGoogle();
      if (firebaseUser) {
        // Exchange Firebase token for backend JWT
        const idToken = await firebaseUser.getIdToken();
        
        try {
          const response = await apiFetch('/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              idToken,
              email: firebaseUser.email,
              name: firebaseUser.displayName,
              uid: firebaseUser.uid
            })
          });

          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || `Erreur de synchronisation avec le serveur: ${response.status}`);
          }

          const data = await response.json();
          if (data.token) {
            localStorage.setItem('token', data.token);
          }
          
          navigate('/');
        } catch (err: any) {
          throw err;
        }
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la connexion avec Google');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Identifiants ou connexion impossibles');
      }

      if (data.token) {
        localStorage.setItem('token', data.token);
        setUser(data.user);
      }
      
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'La connexion a échoué. Veuillez vérifier vos accès.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex transition-colors duration-300">
      {/* Left Side - Branding & Editorial */}
      <div className="hidden lg:flex lg:w-[55%] bg-slate-900 relative overflow-hidden flex-col justify-between p-20 text-white border-r border-white/5">
        {/* Large Typography Background - Editorial Style */}
        <div className="absolute top-0 right-0 p-10 opacity-[0.03] select-none pointer-events-none origin-top-right scale-150 rotate-12">
          <h1 className="font-display font-black text-[20rem] leading-none uppercase tracking-tighter">
            Ory<br />Compta
          </h1>
        </div>

        {/* Animated Orbs */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.15, 0.25, 0.15],
              rotate: [0, 90, 0]
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute -top-1/4 -left-1/4 w-[80%] h-[80%] bg-brand-green/30 blur-[160px] rounded-full" 
          />
          <motion.div 
            animate={{ 
              scale: [1, 1.4, 1],
              opacity: [0.1, 0.2, 0.1],
              rotate: [0, -90, 0]
            }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            className="absolute -bottom-1/4 -right-1/4 w-[80%] h-[80%] bg-brand-gold/15 blur-[160px] rounded-full" 
          />
        </div>

        {/* Header Rail */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="relative z-10 flex items-center justify-between"
        >
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 rounded-2xl bg-white p-2.5 shadow-2xl flex items-center justify-center border border-white/10 group cursor-pointer hover:rotate-6 transition-transform duration-500">
              <Logo className="w-full h-full" showText={false} />
            </div>
            <div className="h-10 w-px bg-white/10" />
            <div className="flex flex-col">
              <span className="font-display font-black text-2xl tracking-tighter uppercase leading-none">
                Ory<span className="text-brand-gold">Compta</span>
              </span>
              <span className="text-[9px] text-slate-400 uppercase tracking-[0.4em] font-bold mt-1.5">Intelligence Financière</span>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-400">
            v4.0.2 Stable
          </div>
        </motion.div>

        {/* Feature Hero */}
        <div className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 1 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-green/20 text-brand-green-light rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-8 border border-brand-green/20">
              <span className="w-1.5 h-1.5 bg-brand-green-light rounded-full animate-pulse" />
              Adopté par +500 entreprises
            </div>
            
            <h1 className="font-display text-7xl xl:text-8xl font-black mb-12 leading-[0.9] tracking-[-0.04em] uppercase">
              Dirigez avec <br />
              <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-brand-green-light to-emerald-400">Audace</span> et <br />
              Clarté.
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-4">
                <div className="w-12 h-px bg-brand-gold/50" />
                <p className="text-slate-300 text-lg leading-relaxed font-medium">
                  L'unique plateforme comptable alignée sur l'excellence opérationnelle et les standards OHADA.
                </p>
              </div>
              <div className="flex flex-col gap-4">
                {[
                  "Automatisation Smart-IA",
                  "Consolidation Temps Réel",
                  "Expertise multi-sociétés"
                ].map((text, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs font-bold text-slate-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-green" />
                    {text}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Bottom Rail */}
        <div className="relative z-10 flex justify-between items-end">
          <div className="space-y-6">
            <div className="flex -space-x-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center overflow-hidden">
                  <SafeImage 
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i + 10}`} 
                    alt="User" 
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
              <div className="w-8 h-8 rounded-full border-2 border-slate-900 bg-brand-green flex items-center justify-center text-[10px] font-black text-white">
                +5k
              </div>
            </div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest max-w-[200px] leading-normal">
              La confiance des experts comptables à travers toute l'Afrique.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
            <span>© 2026 Ory Group</span>
            <div className="w-10 h-1 px-1 bg-white/5 rounded-full">
              <div className="w-1/2 h-full bg-brand-green rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Refined Login Form */}
      <div className="w-full lg:w-[45%] flex items-center justify-center p-12 bg-white dark:bg-slate-950 relative">
        <div className="w-full max-w-sm space-y-12">
          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="lg:hidden mb-10"
            >
              <Logo className="w-14 h-14" showText={false} />
            </motion.div>
            <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-none uppercase font-display">
              Connexion
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
              Accédez à votre cockpit de gestion financière intelligente.
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 p-4 rounded-xl text-sm flex items-start gap-3 mb-6"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Erreur de connexion</p>
                  <p>{error}</p>
                </div>
              </motion.div>
            )}

            <div className="space-y-6">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full h-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700 active:scale-[0.98] transition-all flex items-center justify-center gap-4 disabled:opacity-70 disabled:cursor-not-allowed shadow-sm hover:shadow-xl hover:shadow-emerald-500/5 group"
              >
                {loading ? (
                   <Loader2 className="animate-spin text-brand-green" />
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-xl bg-white shadow-sm border border-slate-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 p-1.5 shrink-0 overflow-hidden">
                      <SafeImage 
                        src="https://www.gstatic.com/images/branding/googleg/1x/googleg_standard_color_128dp.png" 
                        alt="Google" 
                        className="w-full h-full object-contain" 
                        fallbackSrc="https://developers.google.com/static/identity/images/g-logo.png"
                      />
                    </div>
                    <span>Continuer avec Google</span>
                  </>
                )}
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-100 dark:border-slate-900"></div>
                </div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-[0.3em] font-black">
                  <span className="px-6 bg-white dark:bg-slate-950 text-slate-400 dark:text-slate-600">ID Classique</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 ml-1">E-mail Professionnel</label>
                  <div className="relative group">
                    <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-700 group-focus-within:text-brand-green transition-colors" size={18} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full h-14 pl-14 pr-5 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-900 rounded-2xl focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green outline-none transition-all font-bold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm"
                      placeholder="nom@entreprise.com"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Accès Sécurisé</label>
                    <a href="#" className="text-[10px] font-black uppercase tracking-[0.1em] text-brand-green hover:text-emerald-400 transition-colors">
                      Oubli ?
                    </a>
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-700 group-focus-within:text-brand-green transition-colors" size={18} />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full h-14 pl-14 pr-5 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-900 rounded-2xl focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green outline-none transition-all font-bold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 ml-1">
                  <div className="relative flex items-center">
                    <input 
                      type="checkbox" 
                      id="remember" 
                      className="peer w-5 h-5 rounded-lg border-slate-200 dark:border-slate-800 text-brand-green focus:ring-brand-green bg-slate-50 dark:bg-slate-900 transition-all cursor-pointer appearance-none border checked:bg-brand-green checked:border-brand-green"
                    />
                    <CheckCircle2 className="absolute w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 left-0.5 pointer-events-none transition-opacity" />
                  </div>
                  <label htmlFor="remember" className="text-xs text-slate-500 dark:text-slate-400 cursor-pointer select-none font-bold uppercase tracking-wider">
                    Maintenir la session
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-16 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-2xl font-black text-[13px] uppercase tracking-[0.3em] hover:bg-brand-green dark:hover:bg-brand-green-light hover:shadow-2xl hover:shadow-brand-green/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed group"
                >
                  {loading ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <>
                      Validation 
                      <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-12 pt-8 border-t border-slate-100 dark:border-slate-900 text-center">
                <p className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
                  Nouveau utilisateur ?{' '}
                  <Link to="/register" className="text-brand-green hover:text-brand-green-light transition-colors ml-2 underline decoration-brand-green/30 underline-offset-4 decoration-2">
                    Création de compte
                  </Link>
                </p>
              </div>

            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
