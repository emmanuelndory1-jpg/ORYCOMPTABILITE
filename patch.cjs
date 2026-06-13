const fs = require('fs');

const path = 'src/components/FinancialStatements.tsx';
let code = fs.readFileSync(path, 'utf8');

const regex = /\{\/\* Content \*\/\}.*?<\/div>\n    <\/div>\n  \);\n\}/s;

const newContent = `{/* Content */}
      <div className="mt-8 transition-all duration-500">
        {activeTab === 'income' ? (
          <div className="premium-card p-6 md:p-10 max-w-4xl mx-auto my-6 bg-white dark:bg-slate-900/80">
            <div className="text-center mb-8 sm:mb-12">
              <h2 className="text-2xl sm:text-3xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tight">Compte de Résultat</h2>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-2">{activeYear?.name ? \`Exercice \${activeYear.name}\` : 'Exercice en cours'}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr>
                    <th className="py-4 px-4 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 w-2/3 border-b-2 border-slate-100 dark:border-slate-800">Libellé</th>
                    <th className="py-4 px-4 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 w-1/3 text-right border-b-2 border-slate-100 dark:border-slate-800">Montant</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                    <td colSpan={2} className="py-3 px-4 font-bold text-brand-green uppercase text-[10px] tracking-wider border-b border-brand-green/20">Produits (Classe 7)</td>
                  </tr>
                  <tr className="border-b border-slate-100 dark:border-slate-800/50 group hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                    <td className="py-3 px-4 text-slate-600 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-200 transition-colors">Ventes de marchandises (701)</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-900 dark:text-slate-100">{formatCurrency(data.incomeStatement.details.sales)}</td>
                  </tr>
                  <tr className="border-b border-slate-100 dark:border-slate-800/50 group hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                    <td className="py-3 px-4 text-slate-600 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-200 transition-colors">Prestations de services (706)</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-900 dark:text-slate-100">{formatCurrency(data.incomeStatement.details.services)}</td>
                  </tr>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 font-bold border-b-2 border-slate-200 dark:border-slate-700">
                    <td className="py-4 px-4 text-slate-900 dark:text-white text-[13px] uppercase tracking-wider">Total Produits</td>
                    <td className="py-4 px-4 text-right font-mono text-brand-green">{formatCurrency(data.incomeStatement.revenue)}</td>
                  </tr>

                  <tr><td colSpan={2} className="h-6"></td></tr>

                  <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                    <td colSpan={2} className="py-3 px-4 font-bold text-rose-600 uppercase text-[10px] tracking-wider border-b border-rose-100 dark:border-rose-900/30">Charges (Classe 6)</td>
                  </tr>
                  <tr className="border-b border-slate-100 dark:border-slate-800/50 group hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                    <td className="py-3 px-4 text-slate-600 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-200 transition-colors">Achats (60)</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-900 dark:text-slate-100">{formatCurrency(data.incomeStatement.details.purchases)}</td>
                  </tr>
                  <tr className="border-b border-slate-100 dark:border-slate-800/50 group hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                    <td className="py-3 px-4 text-slate-600 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-200 transition-colors">Services extérieurs (62/63)</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-900 dark:text-slate-100">{formatCurrency(data.incomeStatement.details.otherExpenses)}</td>
                  </tr>
                  <tr className="border-b border-slate-100 dark:border-slate-800/50 group hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                    <td className="py-3 px-4 text-slate-600 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-200 transition-colors">Impôts et taxes (64)</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-900 dark:text-slate-100">{formatCurrency(data.incomeStatement.details.taxes)}</td>
                  </tr>
                  <tr className="border-b border-slate-100 dark:border-slate-800/50 group hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                    <td className="py-3 px-4 text-slate-600 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-200 transition-colors">Charges de personnel (66)</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-900 dark:text-slate-100">{formatCurrency(data.incomeStatement.details.personnel)}</td>
                  </tr>
                  <tr className="border-b border-slate-100 dark:border-slate-800/50 group hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                    <td className="py-3 px-4 text-slate-600 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-200 transition-colors">Dotations aux amortissements (68)</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-900 dark:text-slate-100">{formatCurrency(data.incomeStatement.details.depreciation)}</td>
                  </tr>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 font-bold border-b-2 border-slate-200 dark:border-slate-700">
                    <td className="py-4 px-4 text-slate-900 dark:text-white text-[13px] uppercase tracking-wider">Total Charges</td>
                    <td className="py-4 px-4 text-right font-mono text-rose-600">{formatCurrency(data.incomeStatement.expenses)}</td>
                  </tr>

                  <tr><td colSpan={2} className="h-8"></td></tr>

                  <tr className={cn(
                    "font-black text-lg sm:text-xl",
                    data.incomeStatement.netIncome >= 0 ? "bg-brand-green/10 text-brand-green-dark dark:text-brand-green" : "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400"
                  )}>
                    <td className="py-5 px-4 rounded-l-2xl uppercase tracking-wider">RÉSULTAT NET</td>
                    <td className="py-5 px-4 text-right font-mono rounded-r-2xl">{formatCurrency(data.incomeStatement.netIncome)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : activeTab === 'balance' ? (
          <div className="premium-card p-6 md:p-10 max-w-5xl mx-auto my-6 bg-white dark:bg-slate-900/80">
            <div className="text-center mb-8 sm:mb-12">
              <h2 className="text-2xl sm:text-3xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tight">Bilan</h2>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-2">Au {new Date().toLocaleDateString()}</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
              {/* ACTIF */}
              <div className="shadow-lg shadow-slate-200/50 dark:shadow-none rounded-2xl">
                <div className="bg-slate-900 text-white dark:bg-white dark:text-slate-900 py-3.5 px-4 rounded-t-2xl font-black uppercase tracking-widest text-[13px] text-center">
                  Actif
                </div>
                <table className="w-full text-left border-collapse border border-slate-200 dark:border-slate-700 rounded-b-2xl border-t-0 bg-white dark:bg-slate-900/50">
                  <tbody className="text-sm">
                    <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                      <td colSpan={2} className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">Actif Immobilisé</td>
                    </tr>
                    <tr className="border-b border-slate-100 dark:border-slate-800/50 group hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                      <td className="py-4 px-4 text-slate-600 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-200 transition-colors">Immobilisations (Cl. 2)</td>
                      <td className="py-4 px-4 text-right font-mono text-slate-900 dark:text-slate-100">{formatCurrency(data.balanceSheet.assets.fixed)}</td>
                    </tr>

                    <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                      <td colSpan={2} className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">Actif Circulant</td>
                    </tr>
                    <tr className="border-b border-slate-100 dark:border-slate-800/50 group hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                      <td className="py-4 px-4 text-slate-600 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-200 transition-colors">Stocks & Créances (Cl. 3/4)</td>
                      <td className="py-4 px-4 text-right font-mono text-slate-900 dark:text-slate-100">{formatCurrency(data.balanceSheet.assets.current)}</td>
                    </tr>

                    <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                      <td colSpan={2} className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">Trésorerie Actif</td>
                    </tr>
                    <tr className="border-b border-slate-100 dark:border-slate-800/50 group hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                      <td className="py-4 px-4 text-slate-600 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-200 transition-colors">Disponibilités (Cl. 5)</td>
                      <td className="py-4 px-4 text-right font-mono text-slate-900 dark:text-slate-100">{formatCurrency(data.balanceSheet.assets.cash)}</td>
                    </tr>

                    <tr className="bg-slate-100 dark:bg-slate-800 font-black text-[15px] border-t-2 border-slate-200 dark:border-slate-700">
                      <td className="py-5 px-4 text-slate-900 dark:text-white uppercase tracking-wider rounded-bl-2xl">Total Actif</td>
                      <td className="py-5 px-4 text-right font-mono text-slate-900 dark:text-white rounded-br-2xl">{formatCurrency(data.balanceSheet.assets.total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* PASSIF */}
              <div className="shadow-lg shadow-slate-200/50 dark:shadow-none rounded-2xl">
                <div className="bg-slate-900 text-white dark:bg-white dark:text-slate-900 py-3.5 px-4 rounded-t-2xl font-black uppercase tracking-widest text-[13px] text-center">
                  Passif
                </div>
                <table className="w-full text-left border-collapse border border-slate-200 dark:border-slate-700 rounded-b-2xl border-t-0 bg-white dark:bg-slate-900/50">
                  <tbody className="text-sm">
                    <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                      <td colSpan={2} className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">Capitaux Propres</td>
                    </tr>
                    <tr className="border-b border-slate-100 dark:border-slate-800/50 group hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                      <td className="py-4 px-4 text-slate-600 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-200 transition-colors">Capital & Réserves (Cl. 1)</td>
                      <td className="py-4 px-4 text-right font-mono text-slate-900 dark:text-slate-100">{formatCurrency(data.balanceSheet.liabilities.equity)}</td>
                    </tr>
                    <tr className="border-b border-slate-100 dark:border-slate-800/50 group hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                      <td className="py-4 px-4 text-brand-green font-bold flex items-center gap-1.5"><TrendingUp size={14} className="text-brand-green" /> Résultat de l'exercice</td>
                      <td className="py-4 px-4 text-right font-mono text-brand-green font-bold">{formatCurrency(data.incomeStatement.netIncome)}</td>
                    </tr>

                    <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                      <td colSpan={2} className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">Dettes</td>
                    </tr>
                    <tr className="border-b border-slate-100 dark:border-slate-800/50 group hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                      <td className="py-4 px-4 text-slate-600 group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-200 transition-colors">Dettes Fournisseurs & Fiscales (Cl. 4)</td>
                      <td className="py-4 px-4 text-right font-mono text-slate-900 dark:text-slate-100">{formatCurrency(data.balanceSheet.liabilities.debts)}</td>
                    </tr>

                    <tr className="bg-slate-100 dark:bg-slate-800 font-black text-[15px] border-t-2 border-slate-200 dark:border-slate-700">
                      <td className="py-5 px-4 text-slate-900 dark:text-white uppercase tracking-wider rounded-bl-2xl">Total Passif</td>
                      <td className="py-5 px-4 text-right font-mono text-slate-900 dark:text-white rounded-br-2xl">{formatCurrency(data.balanceSheet.liabilities.total + data.incomeStatement.netIncome)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : activeTab === 'cash' ? (
          <div className="premium-card p-6 md:p-10 max-w-4xl mx-auto my-6 bg-white dark:bg-slate-900/80">
            <div className="text-center mb-8 sm:mb-12">
              <h2 className="text-2xl sm:text-3xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tight">Flux de Trésorerie</h2>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-2">{startDate || endDate ? 'Période analysée' : 'Période en cours'}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <tbody className="text-sm">
                  <tr className="border-b border-slate-100 dark:border-slate-800/50 group hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                    <td className="py-5 px-4 w-2/3">
                      <div className="font-bold text-slate-900 dark:text-white text-[15px] group-hover:text-brand-green transition-colors">Flux d'Exploitation</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 italic mt-1 font-medium">Résultat net + Amortissements (Simplifié)</div>
                    </td>
                    <td className={cn("py-5 px-4 text-right font-mono font-bold text-lg", data.cashFlow.operating >= 0 ? "text-brand-green" : "text-rose-600")}>
                      {formatCurrency(data.cashFlow.operating)}
                    </td>
                  </tr>
                  
                  <tr className="border-b border-slate-100 dark:border-slate-800/50 group hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                    <td className="py-5 px-4 w-2/3">
                      <div className="font-bold text-slate-900 dark:text-white text-[15px] group-hover:text-brand-green transition-colors">Flux d'Investissement</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 italic mt-1 font-medium">Acquisitions d'immobilisations</div>
                    </td>
                    <td className={cn("py-5 px-4 text-right font-mono font-bold text-lg", data.cashFlow.investing >= 0 ? "text-brand-green" : "text-rose-600")}>
                      {formatCurrency(data.cashFlow.investing)}
                    </td>
                  </tr>

                  <tr className="border-b border-slate-100 dark:border-slate-800/50 group hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                    <td className="py-5 px-4 w-2/3">
                      <div className="font-bold text-slate-900 dark:text-white text-[15px] group-hover:text-brand-green transition-colors">Flux de Financement</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 italic mt-1 font-medium">Nouveaux emprunts et capitaux</div>
                    </td>
                    <td className={cn("py-5 px-4 text-right font-mono font-bold text-lg", data.cashFlow.financing >= 0 ? "text-brand-green" : "text-rose-600")}>
                      {formatCurrency(data.cashFlow.financing)}
                    </td>
                  </tr>

                  <tr><td colSpan={2} className="h-6"></td></tr>

                  <tr className={cn(
                    "font-black text-lg",
                    data.cashFlow.netChange >= 0 ? "bg-brand-green/10 text-brand-green-dark dark:text-brand-green" : "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400"
                  )}>
                    <td className="py-5 px-4 rounded-l-2xl uppercase tracking-wider">Variation Nette de Trésorerie</td>
                    <td className="py-5 px-4 text-right font-mono rounded-r-2xl">{formatCurrency(data.cashFlow.netChange)}</td>
                  </tr>

                  <tr><td colSpan={2} className="h-6"></td></tr>

                  <tr className="bg-slate-50 dark:bg-slate-800/30 border-t-2 border-slate-200 dark:border-slate-700">
                    <td className="py-5 px-4 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-xs">Trésorerie au début de la période</td>
                    <td className="py-5 px-4 text-right font-mono text-slate-900 dark:text-white font-bold">{formatCurrency(data.cashFlow.startBalance)}</td>
                  </tr>
                  
                  <tr className="bg-slate-900 dark:bg-white text-white dark:text-slate-900">
                    <td className="py-5 px-4 font-black uppercase tracking-widest text-[13px] rounded-bl-2xl">Trésorerie à la fin de la période</td>
                    <td className="py-5 px-4 text-right font-mono font-black text-xl rounded-br-2xl">{formatCurrency(data.cashFlow.endBalance)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="premium-card p-6 md:p-10 max-w-5xl mx-auto my-6 bg-white dark:bg-slate-900/80">
            <div className="text-center mb-8 sm:mb-12">
              <h2 className="text-2xl sm:text-3xl font-display font-black text-slate-900 dark:text-white uppercase tracking-tight">Ratios de Performance & Structure</h2>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-2">Analyse de la santé financière</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
              {/* Liquidity */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600 group overflow-hidden">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">Liquidité Générale</h3>
                    <span className={cn(
                      "px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest",
                      ratios!.liquidity > 1.2 ? "bg-brand-green/10 text-brand-green border border-brand-green/20" : "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                    )}>
                      {ratios!.liquidity > 1.2 ? 'Optimale' : 'À surveiller'}
                    </span>
                  </div>
                  <div className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white mb-3 tracking-tighter group-hover:text-brand-green transition-colors">{ratios!.liquidity.toFixed(2)}x</div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">Capacité à payer les dettes de court terme avec l'actif circulant.</p>
                </div>
                <div className="border-t border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 p-4 px-6">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">Fonds de Roulement Net</span>
                    <span className={cn("font-bold font-mono text-sm", ratios!.workingCapital >= 0 ? "text-brand-green" : "text-rose-600")}>
                      {formatCurrency(ratios!.workingCapital)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Net Margin */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600 group">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">Marge Nette</h3>
                  <span className={cn(
                    "px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border",
                    ratios!.netMargin > 10 ? "bg-brand-green/10 text-brand-green border-brand-green/20" : "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                  )}>
                    {ratios!.netMargin > 10 ? 'Rentable' : 'Standard'}
                  </span>
                </div>
                <div className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white mb-3 tracking-tighter group-hover:text-brand-green transition-colors">{ratios!.netMargin.toFixed(1)}%</div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">Part du bénéfice net dégagée après couverture de toutes les charges.</p>
              </div>

              {/* Solvency */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600 group">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">Autonomie Financière</h3>
                  <span className={cn(
                    "px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border",
                    ratios!.solvency > 30 ? "bg-brand-green/10 text-brand-green border-brand-green/20" : "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800"
                  )}>
                    {ratios!.solvency > 30 ? 'Solide' : 'Endettée'}
                  </span>
                </div>
                <div className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white mb-3 tracking-tighter group-hover:text-brand-green transition-colors">{ratios!.solvency.toFixed(1)}%</div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">Poids des capitaux propres par rapport à l'ensemble du financement.</p>
              </div>

              {/* ROE */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600 group">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">Rentabilité (ROE)</h3>
                  <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-md text-[10px] font-black uppercase tracking-widest">
                    Performance
                  </span>
                </div>
                <div className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white mb-3 tracking-tighter group-hover:text-brand-green transition-colors">{ratios!.roe.toFixed(1)}%</div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">Retour sur investissement généré pour les associés ou actionnaires.</p>
              </div>
            </div>

            <div className="mt-8 lg:mt-10 p-6 bg-slate-900 dark:bg-slate-800 border border-slate-800 dark:border-slate-700 rounded-2xl shadow-xl flex gap-4 items-start">
              <div className="p-2.5 bg-brand-green/20 rounded-xl shrink-0 mt-1">
                <AlertCircle size={24} className="text-brand-green" />
              </div>
              <div>
                <h4 className="text-white font-black mb-2 text-sm uppercase tracking-widest">
                  Interprétation OHADA
                </h4>
                <p className="text-sm text-slate-300 dark:text-slate-400 leading-relaxed font-medium">
                  Ces indicateurs sont conformes aux normes d'analyse SYSCOHADA. Une autonomie financière supérieure à 33% est recommandée, garantissant que les capitaux propres couvrent au moins un tiers du passif total.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}`;

if (regex.test(code)) {
  code = code.replace(regex, newContent);
  fs.writeFileSync(path, code);
  console.log('Success');
} else {
  console.log('Did not match regex');
}
