import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation, Navigate, Outlet, useNavigate, Link } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Logo } from './components/Logo';
import { Dashboard } from './components/Dashboard';
import { FloatingAdvisor as FloatingAssistant } from './components/FloatingAdvisor';
import { Accounts } from './components/Accounts';
import { ExpertAdvisor as Assistant } from './components/ExpertAdvisor';
import { Journal } from './components/Journal';
import { Treasury } from './components/Treasury';
import { FinancialStatements } from './components/FinancialStatements';
import { CustomReports } from './components/CustomReports';
import { ComplianceAudit } from './components/ComplianceAudit';
import { AssetsManager } from './components/AssetsManager';
import { RecurringTransactions } from './components/RecurringTransactions';
import { AuditLogViewer } from './components/AuditLogViewer';
import { CompanyCreation } from './components/CompanyCreation';
import { Settings } from './components/Settings';
import { Breadcrumbs } from './components/Breadcrumbs';
import { GeneralLedger } from './components/GeneralLedger';
import { TrialBalance } from './components/TrialBalance';
import { TaxManager } from './components/TaxManager';
import { PayrollManager } from './components/PayrollManager';
import { ThirdPartyManager } from './components/ThirdPartyManager';
import { BudgetManager } from './components/BudgetManager';
import { InvoicingManager } from './components/InvoicingManager';
import { MobileNav } from './components/MobileNav';
import { QuickActionFAB } from './components/QuickActionFAB';
import { PricingPage } from './components/PricingPage';
import { MockPaymentPage } from './components/MockPaymentPage';
import { LoginPage } from './components/LoginPage';
import { RegisterPage } from './components/RegisterPage';
import { TaxAssistant } from './components/TaxAssistant';
import { BankReconciliation } from './components/BankReconciliation';
import { TeamManager } from './components/TeamManager';
import { FinancialAuditor } from './components/FinancialAuditor';
import { Header } from './components/Header';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { FiscalYearProvider } from './context/FiscalYearContext';
import { ModuleProvider } from './context/ModuleContext';
import { DialogProvider } from './components/DialogProvider';
import { apiFetch } from './lib/api';
import { Loader2, Menu, Moon, Sun } from 'lucide-react';

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
        <Loader2 className="animate-spin text-brand-green" size={48} />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
        <Loader2 className="animate-spin text-brand-green" size={48} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

function DashboardLayout() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCompanyCreated, setIsCompanyCreated] = useState<boolean | null>(null);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [openJournalModal, setOpenJournalModal] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const fetchCompanyStatus = async () => {
    // Safety check to prevent infinite loading if the network is totally blocked
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Fetch timeout')), 15000));
    
    try {
      const resPromise = apiFetch('/api/company/status');
      const res = await Promise.race([resPromise, timeoutPromise]) as Response;
      
      if (!res.ok) throw new Error('Failed to fetch status');
      const data = await res.json();
      setIsCompanyCreated(data.created);
      
      if (data.created) {
        try {
          const dossierRes = await apiFetch('/api/company/dossier');
          if (dossierRes.ok) {
            const dossier = await dossierRes.json();
            if (dossier.settings) {
              setCompanySettings(dossier.settings);
            }
          }
        } catch (e) {
          console.warn("Secondary fetch failed, but status is OK");
        }
      }
    } catch (err) {
      console.error("Failed to fetch company status:", err);
      // If primary check fails, we assume uncreated to unblock the UI
      setIsCompanyCreated(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCompanyStatus();
    } else {
      setIsCompanyCreated(false);
    }
  }, [user]);

  const handleQuickAction = (action: string) => {
    if (action === 'new' || action === 'scan') {
      navigate('/journal');
      setOpenJournalModal(true);
    }
  };

  if (isCompanyCreated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="animate-spin text-brand-green" size={48} />
      </div>
    );
  }

  if (!isCompanyCreated) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl">
          <CompanyCreation onComplete={fetchCompanyStatus} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <Sidebar 
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        companyName={companySettings?.name || 'Ma PME'}
        user={user}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden pb-20 md:pb-0 relative">
        <div className="hidden md:block">
          <Header />
        </div>
        
        {/* Mobile Header */}
        <div className="md:hidden bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-white/5 px-4 h-16 flex items-center justify-between sticky top-0 z-40 transition-colors duration-300 shadow-sm">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center shadow-lg shadow-brand-green/20 border border-slate-100 dark:border-white/5 transition-transform active:scale-95">
              <Logo className="w-5 h-5 text-brand-green" showText={false} />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-xs tracking-tight text-slate-900 dark:text-white uppercase">ORYCOMPTA</span>
              <span className="text-[7px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Expert OHADA</span>
            </div>
          </Link>
          
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setIsMobileOpen(true)} 
              className="p-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-2xl transition-all active:scale-90"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto scroll-smooth">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8">
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Outlet context={{ openJournalModal, setOpenJournalModal, companySettings }} />
            </div>
          </div>
        </div>

        <FloatingAssistant />
        <QuickActionFAB onAction={handleQuickAction} />
        <MobileNav onMenuClick={() => setIsMobileOpen(true)} />
      </main>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    // Initialize CSRF token with retry for cold starts
    const initCsrf = async (retries = 3) => {
      for (let i = 0; i < retries; i++) {
        try {
    const res = await apiFetch('/api/csrf-token');
    if (res.ok) {
      const { token } = await res.json();
      if (token) {
        localStorage.setItem('XSRF-TOKEN', token);
        console.log('CSRF initialized');
      }
      return;
    }
        } catch (e) {
          if (i === retries - 1) console.error("Final CSRF init failure:", e);
          else console.warn(`CSRF init retry ${i + 1}/${retries}...`);
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    };
    initCsrf();
  }, []);

  return (
    <ThemeProvider>
      <LanguageProvider>
        <DialogProvider>
          <AuthProvider>
            <ModuleProvider>
              <FiscalYearProvider>
                <Routes>
                <Route path="/login" element={
                  <PublicRoute>
                    <LoginPage />
                  </PublicRoute>
                } />
                <Route path="/register" element={
                  <PublicRoute>
                    <RegisterPage />
                  </PublicRoute>
                } />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/mock-payment" element={<MockPaymentPage />} />
                <Route 
                  path="/" 
                  element={
                    <ProtectedRoute>
                      <DashboardLayout />
                    </ProtectedRoute>
                  } 
                >
                  <Route index element={<Dashboard />} />
                  <Route path="accounts" element={<Accounts />} />
                  <Route path="journal" element={<JournalWrapper />} />
                  <Route path="ledger" element={<GeneralLedger />} />
                  <Route path="trial-balance" element={<TrialBalance />} />
                  <Route path="financials" element={<FinancialStatements />} />
                  <Route path="custom-reports" element={<CustomReports />} />
                  <Route path="compliance" element={<ComplianceAudit />} />
                  <Route path="recurring" element={<RecurringTransactions />} />
                  <Route path="assets" element={<AssetsManager />} />
                  <Route path="company" element={<CompanyCreation />} />
                  <Route path="treasury" element={<Treasury />} />
                  <Route path="reconciliation" element={<BankReconciliation />} />
                  <Route path="vat" element={<TaxManager />} />
                  <Route path="payroll" element={<PayrollManager />} />
                  <Route path="third-parties" element={<ThirdPartyManager />} />
                  <Route path="budgets" element={<BudgetManager />} />
                  <Route path="invoicing" element={<InvoicingManager />} />
                  <Route path="audit" element={<AuditLogViewer />} />
                  <Route path="assistant" element={<Assistant />} />
                  <Route path="tax-assistant" element={<TaxAssistant />} />
                  <Route path="financial-auditor" element={<FinancialAuditor />} />
                  <Route path="team" element={<TeamManager />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="*" element={<div className="p-8 text-center text-slate-500 dark:text-slate-400">Module en cours de développement...</div>} />
                </Route>
              </Routes>
            </FiscalYearProvider>
          </ModuleProvider>
          </AuthProvider>
        </DialogProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

import { useOutletContext } from 'react-router-dom';

function JournalWrapper() {
  const { openJournalModal, setOpenJournalModal } = useOutletContext<{ openJournalModal: boolean; setOpenJournalModal: (val: boolean) => void }>();
  return <Journal openModal={openJournalModal} onModalClose={() => setOpenJournalModal(false)} />;
}
