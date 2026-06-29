import * as React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './i18n';

// Context
import { AuthProvider, useAuth } from '@/src/contexts/AuthContext';

// Components
import { Navbar, Footer } from '@/src/components/layout';

// Pages
import { HomePage } from '@/src/pages/Home';
import { AppraisersPage } from '@/src/pages/Appraisers';
import { AppraiserProfilePage } from '@/src/pages/AppraiserProfile';
import { LoginPage, SignupPage } from '@/src/pages/Auth';
import { MethodologyPage } from '@/src/pages/Methodology';
import { OnboardingPage } from '@/src/pages/onboarding/Onboarding';
import { UnderReviewPage } from '@/src/pages/onboarding/UnderReview';
import { DashboardPage } from '@/src/pages/Dashboard';
import { ReportsPage } from '@/src/pages/Reports';
import { ReportEditorPage } from '@/src/pages/reports/ReportEditor';
import { VerificationsPage } from '@/src/pages/admin/Verifications';
import { InvitesPage } from '@/src/pages/admin/Invites';
import { BanksPage } from '@/src/pages/admin/Banks';
import { AuditLogPage } from '@/src/pages/admin/AuditLog';
import { BacklogUploadPage, ReviewQueuePage, ReviewDetailPage } from '@/src/pages/backlog';

// Sprint 5 Pages
import { AnalyticsDashboardPage } from '@/src/pages/bank';
import { RequestAppraisalPage, MyJobsPage, JobDetailPage, PaymentCheckoutPage } from '@/src/pages/marketplace';

// Bank Marketplace Pages
import BankMarketplace from '@/src/pages/bank/Marketplace';
import BankCart from '@/src/pages/bank/Cart';
import PurchasedReports from '@/src/pages/bank/PurchasedReports';
import ReportViewer from '@/src/pages/bank/ReportViewer';

// Sprint 6 Pages
import AppraiserJobsDashboard from '@/src/pages/appraiser/JobsDashboard';
import AppraiserJobDetail from '@/src/pages/appraiser/JobDetail';
import DeliverReportPage from '@/src/pages/appraiser/DeliverReport';
import AppraiserPricingSettings from '@/src/pages/appraiser/PricingSettings';

// Scroll to top on route change
function ScrollToTop() {
  const { pathname } = useLocation();
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

// Protected route wrapper for appraisers
function AppraiserRoute({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  if (profile.role !== 'appraiser') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// Protected route wrapper for admins
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  if (profile.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// Protected route wrapper for bank users
function BankRoute({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  if (profile.role !== 'bank' && profile.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// Protected route wrapper for any authenticated user (marketplace)
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Admin layout with navigation
function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  const navItems = [
    { path: '/admin/verifications', label: 'Verifications' },
    { path: '/admin/banks', label: 'Banks' },
    { path: '/admin/invites', label: 'Invites' },
    { path: '/admin/audit-log', label: 'Audit Log' },
  ];

  return (
    <div className="min-h-screen bg-cream-100">
      {/* Admin nav */}
      <div className="bg-cream-50 border-b border-ink-100 px-5">
        <div className="max-w-7xl mx-auto flex items-center gap-8 py-3">
          <span className="text-[11px] font-medium text-ink-400 uppercase tracking-wider">Admin</span>
          <div className="flex gap-6">
            {navItems.map((item) => (
              <a
                key={item.path}
                href={item.path}
                className={`text-body-s font-medium transition-colors ${
                  location.pathname === item.path
                    ? 'text-emerald-600'
                    : 'text-ink-400 hover:text-ink-600'
                }`}
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

// Bank portal layout with navigation
function BankLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  const navItems = [
    { path: '/bank', label: 'Dashboard' },
    { path: '/bank/marketplace', label: 'Marketplace' },
    { path: '/bank/cart', label: 'Cart' },
    { path: '/bank/reports', label: 'Purchased Reports' },
  ];

  return (
    <div className="min-h-screen bg-cream-100">
      <div className="bg-cream-50 border-b border-ink-100 px-5">
        <div className="max-w-7xl mx-auto flex items-center gap-8 py-3">
          <span className="text-[11px] font-medium text-ink-400 uppercase tracking-wider">Bank</span>
          <div className="flex gap-6">
            {navItems.map((item) => (
              <a
                key={item.path}
                href={item.path}
                className={`text-body-s font-medium transition-colors ${
                  location.pathname === item.path
                    ? 'text-emerald-600'
                    : 'text-ink-400 hover:text-ink-600'
                }`}
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

// Owner / marketplace layout with navigation
function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  const navItems = [
    { path: '/marketplace/jobs', label: 'My Appraisals' },
    { path: '/marketplace/request', label: 'Request Appraisal' },
  ];

  return (
    <div className="min-h-screen bg-cream-100">
      <div className="bg-cream-50 border-b border-ink-100 px-5">
        <div className="max-w-7xl mx-auto flex items-center gap-8 py-3">
          <span className="text-[11px] font-medium text-ink-400 uppercase tracking-wider">Marketplace</span>
          <div className="flex gap-6">
            {navItems.map((item) => (
              <a
                key={item.path}
                href={item.path}
                className={`text-body-s font-medium transition-colors ${
                  location.pathname === item.path
                    ? 'text-emerald-600'
                    : 'text-ink-400 hover:text-ink-600'
                }`}
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Paths where a logged-in appraiser with unfinished onboarding should not linger.
const PUBLIC_LANDING_PATHS = ['/', '/login', '/signup'];

/**
 * Routes logged-in appraisers to the right place no matter how they arrive
 * (login form, magic link, or a persisted session landing on the home page).
 * Without this, only /login and /signup ran the redirect, so a returning
 * appraiser could get stranded on the home page with no path into onboarding.
 */
function PostAuthRedirect() {
  const { profile, loading, session } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const lastHandledPath = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (loading || !profile || !session?.access_token) return;
    if (!['appraiser', 'bank', 'owner'].includes(profile.role)) return;

    if (!PUBLIC_LANDING_PATHS.includes(location.pathname)) {
      lastHandledPath.current = null;
      return;
    }
    if (lastHandledPath.current === location.pathname) return;
    lastHandledPath.current = location.pathname;

    const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';

    // Bank/owner users: only pull off the auth pages; let them browse home freely.
    if (profile.role === 'bank') {
      if (isAuthPage) navigate('/bank');
      return;
    }
    if (profile.role === 'owner') {
      if (isAuthPage) navigate('/marketplace/jobs');
      return;
    }

    fetch('/api/onboarding/status', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((status) => {
        if (!status) return;
        if (!status.hasProfile) {
          // Onboarding not submitted yet — always push into onboarding.
          navigate('/onboarding');
        } else if (status.profileStatus === 'verified') {
          // Approved: only pull them off the auth pages; let them browse home.
          if (isAuthPage) navigate('/dashboard');
        } else {
          // Submitted, awaiting/needs admin review.
          if (isAuthPage) navigate('/onboarding/under-review');
        }
      })
      .catch(() => {});
  }, [loading, profile, session, location.pathname, navigate]);

  return null;
}

function AppContent() {
  const { i18n } = useTranslation();
  const location = useLocation();

  // Set initial direction and language on mount
  React.useEffect(() => {
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  // Check if we're on an admin page
  const isAdminPage = location.pathname.startsWith('/admin');

  return (
    <div className="flex flex-col min-h-screen">
      <PostAuthRedirect />
      <Navbar />
      <main className="flex-1">
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/appraisers" element={<AppraisersPage />} />
          <Route path="/appraisers/:id" element={<AppraiserProfilePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/methodology" element={<MethodologyPage />} />

          {/* Appraiser protected routes */}
          <Route
            path="/onboarding"
            element={
              <AppraiserRoute>
                <OnboardingPage />
              </AppraiserRoute>
            }
          />
          <Route
            path="/onboarding/under-review"
            element={
              <AppraiserRoute>
                <UnderReviewPage />
              </AppraiserRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <AppraiserRoute>
                <DashboardPage />
              </AppraiserRoute>
            }
          />
          <Route
            path="/dashboard/reports"
            element={
              <AppraiserRoute>
                <ReportsPage />
              </AppraiserRoute>
            }
          />
          <Route
            path="/reports/:id/edit"
            element={
              <AppraiserRoute>
                <ReportEditorPage />
              </AppraiserRoute>
            }
          />
          <Route
            path="/dashboard/backlog"
            element={
              <AppraiserRoute>
                <BacklogUploadPage />
              </AppraiserRoute>
            }
          />
          <Route
            path="/dashboard/backlog/review"
            element={
              <AppraiserRoute>
                <ReviewQueuePage />
              </AppraiserRoute>
            }
          />
          <Route
            path="/dashboard/backlog/review/:id"
            element={
              <AppraiserRoute>
                <ReviewDetailPage />
              </AppraiserRoute>
            }
          />
          <Route
            path="/appraiser/jobs"
            element={
              <AppraiserRoute>
                <AppraiserJobsDashboard />
              </AppraiserRoute>
            }
          />
          <Route
            path="/appraiser/jobs/:id"
            element={
              <AppraiserRoute>
                <AppraiserJobDetail />
              </AppraiserRoute>
            }
          />
          <Route
            path="/appraiser/jobs/:id/deliver"
            element={
              <AppraiserRoute>
                <DeliverReportPage />
              </AppraiserRoute>
            }
          />
          <Route
            path="/appraiser/pricing"
            element={
              <AppraiserRoute>
                <AppraiserPricingSettings />
              </AppraiserRoute>
            }
          />

          {/* Admin protected routes */}
          <Route
            path="/admin/verifications"
            element={
              <AdminRoute>
                <AdminLayout>
                  <VerificationsPage />
                </AdminLayout>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/banks"
            element={
              <AdminRoute>
                <AdminLayout>
                  <BanksPage />
                </AdminLayout>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/invites"
            element={
              <AdminRoute>
                <AdminLayout>
                  <InvitesPage />
                </AdminLayout>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/audit-log"
            element={
              <AdminRoute>
                <AdminLayout>
                  <AuditLogPage />
                </AdminLayout>
              </AdminRoute>
            }
          />

          {/* Bank protected routes */}
          <Route
            path="/bank"
            element={
              <BankRoute>
                <BankLayout>
                  <AnalyticsDashboardPage />
                </BankLayout>
              </BankRoute>
            }
          />
          <Route
            path="/bank/analytics"
            element={
              <BankRoute>
                <BankLayout>
                  <AnalyticsDashboardPage />
                </BankLayout>
              </BankRoute>
            }
          />
          <Route
            path="/bank/marketplace"
            element={
              <BankRoute>
                <BankLayout>
                  <BankMarketplace />
                </BankLayout>
              </BankRoute>
            }
          />
          <Route
            path="/bank/cart"
            element={
              <BankRoute>
                <BankLayout>
                  <BankCart />
                </BankLayout>
              </BankRoute>
            }
          />
          <Route
            path="/bank/reports"
            element={
              <BankRoute>
                <BankLayout>
                  <PurchasedReports />
                </BankLayout>
              </BankRoute>
            }
          />
          <Route
            path="/bank/reports/:listingId"
            element={
              <BankRoute>
                <BankLayout>
                  <ReportViewer />
                </BankLayout>
              </BankRoute>
            }
          />

          {/* Marketplace routes (any authenticated user) */}
          <Route
            path="/marketplace/request"
            element={
              <ProtectedRoute>
                <MarketplaceLayout>
                  <RequestAppraisalPage />
                </MarketplaceLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/marketplace/jobs"
            element={
              <ProtectedRoute>
                <MarketplaceLayout>
                  <MyJobsPage />
                </MarketplaceLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/marketplace/jobs/:id"
            element={
              <ProtectedRoute>
                <MarketplaceLayout>
                  <JobDetailPage />
                </MarketplaceLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/marketplace/jobs/:id/payment"
            element={
              <ProtectedRoute>
                <MarketplaceLayout>
                  <PaymentCheckoutPage />
                </MarketplaceLayout>
              </ProtectedRoute>
            }
          />

          {/* Auth callback for OAuth */}
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Fallback */}
          <Route path="*" element={<HomePage />} />
        </Routes>
      </main>
      {!isAdminPage && <Footer />}
    </div>
  );
}

// OAuth callback handler
function AuthCallback() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  React.useEffect(() => {
    // Wait for auth to settle
    const timer = setTimeout(() => {
      if (profile) {
        if (profile.role === 'admin') {
          navigate('/admin/verifications');
        } else if (profile.role === 'appraiser') {
          navigate('/onboarding');
        } else {
          navigate('/');
        }
      } else {
        navigate('/login');
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [profile, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-body-s text-ink-400">Completing sign in...</p>
      </div>
    </div>
  );
}

// Need to import useNavigate
import { useNavigate } from 'react-router-dom';

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <ScrollToTop />
        <AppContent />
      </AuthProvider>
    </Router>
  );
}
