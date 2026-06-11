import { triggerCloudBackup } from './lib/backup';
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
import { MobileMoneyManager } from './components/MobileMoneyManager';
import { FinancialStatements } from './components/FinancialStatements';
import { CustomReports } from './components/CustomReports';
import { ComplianceAudit } from './components/ComplianceAudit';
import { AssetsManager } from './components/AssetsManager';
import { ProcureToPay } from './components/ProcureToPay';
import { RecurringTransactions } from './components/RecurringTransactions';
import { AuditLogViewer } from './components/AuditLogViewer';
import { CompanyCreation } from './components/CompanyCreation';
import { Settings } from './components/Settings';
import { Breadcrumbs } from './components/Breadcrumbs';
import { GeneralLedger } from './components/GeneralLedger';
import { TrialBalance } from './components/TrialBalance';
import { TaxManager } from './components/TaxManager';
import { TaxSummaryReport } from './components/TaxSummaryReport';
import { PayrollManager } from './components/PayrollManager';
import { HRDashboard } from './components/HRDashboard';
import { ThirdPartyManager } from './components/ThirdPartyManager';
import { CRMManager } from './components/CRMManager';
import { BudgetManager } from './components/BudgetManager';
import { InvoicingManager } from './components/InvoicingManager';
import { MobileNav } from './components/MobileNav';
import { PricingPage } from './components/PricingPage';
import { MockPaymentPage } from './components/MockPaymentPage';
import { LoginPage } from './components/LoginPage';
import { RegisterPage } from './components/RegisterPage';
import { TermsPage } from './components/TermsPage';
import { PrivacyPage } from './components/PrivacyPage';
import { TaxAssistant } from './components/TaxAssistant';
import { BankReconciliation } from './components/BankReconciliation';
import { TeamManager } from './components/TeamManager';
import { FinancialAuditor } from './components/FinancialAuditor';
import { DocumentManager } from './components/DocumentManager';
import { TasksManager } from './components/TasksManager';
import { MessagingManager } from './components/MessagingManager';
import { AiTrainingDashboard } from './components/AiTrainingDashboard';
import InventoryManager from './components/InventoryManager';
import { Header } from './components/Header';
import { CommandPalette } from './components/CommandPalette';
import { Scratchpad } from './components/Scratchpad';
import { QuickActionFAB } from './components/QuickActionFAB';
import { SyncProvider } from './context/SyncContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { FiscalYearProvider } from './context/FiscalYearContext';
import { ModuleProvider } from './context/ModuleContext';
import { DialogProvider } from './components/DialogProvider';
import { apiFetch } from './lib/api';
import { cn } from './lib/utils';
import { Loader2, Menu, Moon, Sun, WifiOff } from 'lucide-react';

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

import { motion, AnimatePresence } from 'motion/react';

function DashboardLayout() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCompanyCreated, setIsCompanyCreated] = useState<boolean | null>(null);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [openJournalModal, setOpenJournalModal] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const fetchCompanyStatus = async () => {
    // Safety check to prevent infinite loading if the network is totally blocked
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Fetch timeout')), 45000));
    
    try {
      const resPromise = apiFetch('/api/company/status');
      const res = await Promise.race([resPromise, timeoutPromise]) as Response;
      
      if (!res.ok) {
        const errorText = await res.text().catch(() => 'No error body');
        throw new Error(`Failed to fetch status: ${res.status} ${errorText}`);
      }
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

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleQuickAction = (action: string) => {
    if (action === 'voice') {
      navigate('/journal', { state: { triggerVoice: true } });
      return;
    }
    if (action === 'new' || action === 'scan') {
      navigate('/journal');
      setOpenJournalModal(true);
    }
  };

  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'j': e.preventDefault(); navigate('/journal'); break;
          case 'g': e.preventDefault(); navigate('/ledger'); break;
          case 'b': e.preventDefault(); navigate('/trial-balance'); break;
          case 'i': e.preventDefault(); navigate('/'); break;
          case 'f': e.preventDefault(); navigate('/invoicing'); break;
          case 'p': e.preventDefault(); navigate('/payroll'); break;
          case 's': e.preventDefault(); navigate('/settings'); break;
        }
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [navigate]);

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
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-500 selection:bg-brand-green/20 selection:text-brand-green">
      <Sidebar 
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        companyName={companySettings?.name || 'Ma PME'}
        logoUrl={companySettings?.logo_url}
        taxesEnabled={companySettings?.taxes_enabled !== false && Number(companySettings?.taxes_enabled) !== 0}
        user={user}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden pb-20 md:pb-0 relative bg-slate-50/50 dark:bg-[#0f172a]/50">
        <div>
          <Header logoUrl={companySettings?.logo_url} onMenuClick={() => setIsMobileOpen(true)} />
        </div>

        {/* Offline Banner */}
        {!isOnline && (
          <div className="bg-rose-500 text-white px-4 py-2.5 text-xs font-bold flex items-center justify-center gap-2 shadow-md z-50">
            <WifiOff size={16} />
            <span>Mode hors-ligne actif. Vos données seront synchronisées lors de la reconnexion.</span>
          </div>
        )}

        {/* Main Content Area */}
        <div id="main-content-area" className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth custom-scrollbar relative flex flex-col min-w-0 w-full">
          <div className="absolute inset-0 bg-grid-slate-100 dark:bg-grid-white bg-[bottom_1px_center] pointer-events-none opacity-[0.4] dark:opacity-[0.8]" />
          <div className={cn(
            "mx-auto px-4 sm:px-6 md:px-8 lg:px-10 pt-10 pb-6 md:pt-14 md:pb-8 w-full relative z-10 flex flex-col flex-1 min-w-0",
            location.pathname === '/assistant' ? "max-w-full" : "max-w-[1600px] 2xl:max-w-[1800px]"
          )}>
            <AnimatePresence mode="wait">
              <motion.div 
                key={location.pathname} 
                initial={{ opacity: 0, y: 15, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -15, filter: 'blur(4px)' }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="flex flex-col flex-1 min-w-0 w-full"
              >
                <Breadcrumbs />
                <Outlet context={{ openJournalModal, setOpenJournalModal, companySettings, refreshCompanySettings: fetchCompanyStatus }} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <FloatingAssistant />
        <CommandPalette />
        <Scratchpad />
        <QuickActionFAB onAction={(action) => {
          if (action === 'new') {
            navigate('/journal');
          } else if (action === 'scan') {
            navigate('/journal', { state: { action: 'scan' } });
          } else if (action === 'voice') {
            navigate('/assistant');
          } else if (action === 'invoice') {
            navigate('/invoicing', { state: { action: 'new' } });
          } else if (action === 'payroll') {
            navigate('/payroll', { state: { action: 'new' } });
          } else if (action === 'asset') {
            navigate('/assets', { state: { action: 'new' } });
          }
        }} />
        <MobileNav onMenuClick={() => setIsMobileOpen(true)} />
      </main>
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    // Scroll the main content area to top on route change
    const mainContent = document.querySelector('#main-content-area');
    if (mainContent) {
        mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [pathname]);
  return null;
}

export default function App() {
  useEffect(() => {
    // Background Backup Sync Pattern
    // Executes automatically every 6 hours while the app is open
    const initBackupSync = () => {
       const syncInterval = setInterval(() => {
          triggerCloudBackup().catch(e => console.error("Cloud backup failed:", e));
       }, 6 * 60 * 60 * 1000);
       return () => clearInterval(syncInterval);
    };

    const cleanupBackup = initBackupSync();

    // Initialize CSRF token with retry for cold starts
    const initCsrf = async (retries = 3) => {
      for (let i = 0; i < retries; i++) {
        try {
          const res = await apiFetch('/api/csrf-token');
          if (res.ok) {
            const data = await res.json();
            const token = data.csrfToken || data.token;
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
    
    return cleanupBackup;
  }, []);

  return (
    <SyncProvider>
      <ThemeProvider>
        <LanguageProvider>
        <DialogProvider>
          <AuthProvider>
            <ModuleProvider>
              <FiscalYearProvider>
                <ScrollToTop />
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
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
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
                  <Route path="inventory" element={<InventoryManager />} />
                  <Route path="p2p" element={<ProcureToPay />} />
                  <Route path="company" element={<CompanyCreation />} />
                  <Route path="treasury" element={<Treasury />} />
                  <Route path="documents" element={<DocumentManager />} />
                  <Route path="tasks" element={<TasksManager />} />
                  <Route path="messaging" element={<MessagingManager />} />
                  <Route path="mobile-money" element={<MobileMoneyManager />} />
                  <Route path="reconciliation" element={<BankReconciliation />} />
                  <Route path="vat" element={<TaxManager />} />
                  <Route path="tax-report" element={<TaxSummaryReport />} />
                  <Route path="payroll" element={<PayrollManager />} />
                  <Route path="hr-dashboard" element={<HRDashboard />} />
                  <Route path="third-parties" element={<ThirdPartyManager />} />
                  <Route path="crm" element={<CRMManager />} />
                  <Route path="budgets" element={<BudgetManager />} />
                  <Route path="invoicing" element={<InvoicingManager />} />
                  <Route path="audit" element={<AuditLogViewer />} />
                  <Route path="assistant" element={<Assistant />} />
                  <Route path="tax-assistant" element={<TaxAssistant />} />
                  <Route path="financial-auditor" element={<FinancialAuditor />} />
                  <Route path="team" element={<TeamManager />} />
                  <Route path="ai-training" element={<AiTrainingDashboard />} />
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
    </SyncProvider>
  );
}

import { useOutletContext } from 'react-router-dom';

function JournalWrapper() {
  const location = useLocation();
  const { openJournalModal, setOpenJournalModal } = useOutletContext<{ openJournalModal: boolean; setOpenJournalModal: (val: boolean) => void }>();
  
  const [triggerAction, setTriggerAction] = useState<string | null>(null);

  useEffect(() => {
    if (location.state?.action) {
      setTriggerAction(location.state.action);
      // Consume the state so it doesn't trigger again on refresh
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  return <Journal 
    openModal={openJournalModal} 
    onModalClose={() => setOpenJournalModal(false)}
    scanTrigger={triggerAction === 'scan'}
    onScanTriggerConsumed={() => setTriggerAction(null)}
  />;
}
