const fs = require('fs');
let code = fs.readFileSync('src/components/LoginPage.tsx', 'utf8');

if (!code.includes('isResetting')) {
  // Insert state
  code = code.replace(
    "const [error, setError] = useState<string | null>(null);",
    "const [error, setError] = useState<string | null>(null);\n  const [isResetting, setIsResetting] = useState(false);\n  const [resetSuccess, setResetSuccess] = useState(false);\n  const [newPassword, setNewPassword] = useState('');"
  );

  // Insert Reset handler
  const handleReset = `
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResetSuccess(false);
    
    try {
      const response = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, newPassword })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de la réinitialisation');
      }

      setResetSuccess(true);
      setNewPassword('');
      setTimeout(() => {
        setIsResetting(false);
        setResetSuccess(false);
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'La réinitialisation a échoué.');
    } finally {
      setLoading(false);
    }
  };
`;

  code = code.replace(
    "const handleSubmit = async (e: React.FormEvent) => {",
    handleReset + "\n  const handleSubmit = async (e: React.FormEvent) => {"
  );

  // Now the rendering part
  const oldReturnRender = `            <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-none uppercase font-display">
              Connexion
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
              Accédez à votre cockpit de gestion financière intelligente.
            </p>`;

  const newReturnRender = `            <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-none uppercase font-display">
              {isResetting ? 'Réinitialisation' : 'Connexion'}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
              {isResetting ? 'Créez un nouveau mot de passe pour votre compte.' : 'Accédez à votre cockpit de gestion financière intelligente.'}
            </p>`;

  code = code.replace(oldReturnRender, newReturnRender);

  // Success message
  const successMessage = `            {resetSuccess && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400 p-4 rounded-xl text-sm flex items-start gap-3 mb-6"
              >
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Succès</p>
                  <p>Mot de passe réinitialisé. Retour à la connexion...</p>
                </div>
              </motion.div>
            )}`;

  code = code.replace("{error && (", successMessage + "\n            {error && (");


  // Oubli? link to trigger resetting
  code = code.replace(
    `<a href="#" className="text-[10px] font-black uppercase tracking-[0.1em] text-brand-green hover:text-emerald-400 transition-colors">
                      Oubli ?
                    </a>`,
    `<button type="button" onClick={() => { setIsResetting(true); setError(null); }} className="text-[10px] font-black uppercase tracking-[0.1em] text-brand-green hover:text-emerald-400 transition-colors">
                      Oubli ?
                    </button>`
  );

  // Form toggle
  const formReplacement = `              {isResetting ? (
                <form onSubmit={handleReset} className="space-y-8">
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
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 ml-1">Nouveau Mot de passe</label>
                    <div className="relative group">
                      <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-700 group-focus-within:text-brand-green transition-colors" size={18} />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full h-14 pl-14 pr-14 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-900 rounded-2xl focus:bg-white dark:focus:bg-slate-900 focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green outline-none transition-all font-bold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-sm"
                        placeholder="••••••••"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-green transition-colors focus:outline-none"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <button
                      type="submit"
                      disabled={loading || !newPassword}
                      className="w-full h-16 bg-slate-900 dark:bg-white text-white dark:text-slate-950 rounded-2xl font-black text-[13px] uppercase tracking-[0.3em] hover:bg-brand-green dark:hover:bg-brand-green-light hover:shadow-2xl hover:shadow-brand-green/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed group"
                    >
                      {loading ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <>Réinitialiser</>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsResetting(false)}
                      disabled={loading}
                      className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors uppercase tracking-widest text-center"
                    >
                      Retour à la connexion
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-8">`;

  code = code.replace(`<form onSubmit={handleSubmit} className="space-y-8">`, formReplacement);
  
  // Close the ternary
  const endOfForm = `                  )}
                </button>
              </form>`;
  const endReplacement = endOfForm + `
              )}`;
  
  code = code.replace(endOfForm, endReplacement);


  fs.writeFileSync('src/components/LoginPage.tsx', code);
  console.log("Successfully patched states and handler in LoginPage.tsx");
} else {
  console.log("Already patched state.");
}
