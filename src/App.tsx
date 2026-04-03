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
import { ComplianceAudit } from './components/ComplianceAudit';
import { AssetsManager } from './components/AssetsManager';
import { RecurringTransactions } from './components/RecurringTransactions';
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
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { FiscalYearProvider } from './context/FiscalYearContext';
import { DialogProvider } from './components/DialogProvider';
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
    try {
      const res = await fetch('/api/company/status');
      const data = await res.json();
      setIsCompanyCreated(data.created);
      if (data.created) {
        const dossierRes = await fetch('/api/company/dossier');
        const dossier = await dossierRes.json();
        if (dossier.settings) {
          setCompanySettings(dossier.settings);
        }
      }
    } catch (err) {
      console.error("Failed to fetch company status:", err);
      setIsCompanyCreated(false);
    }
  };

  useEffect(() => {
    fetchCompanyStatus();
  }, []);

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
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <Sidebar 
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        companyName={companySettings?.name || 'Ma PME'}
        user={user}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden pb-20 md:pb-0 relative">
        <Header />
        
        {/* Mobile Header */}
        <div className="md:hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between sticky top-0 z-40 transition-colors duration-300">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Logo className="w-5 h-5 text-emerald-600" showText={false} />
            </div>
            <span className="font-black text-sm tracking-tight text-slate-900 dark:text-slate-100">ORYCOMPTA</span>
          </Link>
          <button onClick={() => setIsMobileOpen(true)} className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <Menu size={20} />
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8">
            <div className="mb-6">
              <Breadcrumbs />
            </div>
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Outlet context={{ openJournalModal, setOpenJournalModal, companySettings }} />
            </div>
          </div>
        </div>

        <QuickActionFAB onAction={handleQuickAction} />
        <FloatingAssistant />
        <MobileNav 
          onMenuClick={() => setIsMobileOpen(true)} 
        />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <DialogProvider>
          <AuthProvider>
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
                <Route path="assistant" element={<Assistant />} />
                <Route path="tax-assistant" element={<TaxAssistant />} />
                <Route path="financial-auditor" element={<FinancialAuditor />} />
                <Route path="team" element={<TeamManager />} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<div className="p-8 text-center text-slate-500 dark:text-slate-400">Module en cours de développement...</div>} />
              </Route>
            </Routes>
          </FiscalYearProvider>
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
