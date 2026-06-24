import { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from '@/store/auth.store';
import { SidebarProvider } from '@/contexts/SidebarContext';
import { ProtectedRoute, PublicRoute, ClinicMemberRoute, ClinicSetupRoute, ChangePasswordRoute, ResetPasswordRoute, OnboardingPasswordRoute } from './router';
import { LogoutConfirmModal } from '@/components/modals/LogoutConfirmModal';
import { SessionExpiryWarningModal } from '@/components/modals/SessionExpiryWarningModal';
import { useLogoutConfirm } from '@/hooks/useLogoutConfirm';
import { useInactivityLogout } from '@/hooks/useInactivityLogout';

//vercel web analytics
import { Analytics } from "@vercel/analytics/react";

// Public Pages
import { LandingPage }            from '@/features/landing/LandingPage';
import { Login }                  from '@/features/auth/Login';
import { AdminRegister }          from '@/features/auth/AdminRegister';
import { RegisterSuccess }        from '@/features/auth/RegisterSuccess';
import { SetOnboardingPasswordPage } from '@/features/auth/SetOnboardingPasswordPage';
import { ForgotPassword }         from '@/features/auth/ForgotPassword';
import { ForgotPasswordOTP }      from '@/features/auth/ForgotPasswordOTP';
import { ResetPasswordPage }      from '@/features/auth/ResetPasswordPage';
import { ChangePasswordPage }     from '@/features/auth/ChangePasswordPage';
import { PortalHome }             from '@/features/patient-portal/pages/PortalHome';
import { BookAppointmentSuccess } from '@/features/patient-portal/pages/BookAppointmentSuccess';
import { ClientFormPublicPage }   from '@/features/patients/pages/ClientFormPublicPage';
import { RebookPage }             from '@/features/appointments/RebookPage';
import { AppointmentConfirmPage } from '@/features/appointments/AppointmentConfirmPage';

// Footer Pages - Product
import { Features }  from '@/features/landing/components/footer-pages/Product/Features';
import { Pricing }   from '@/features/landing/components/footer-pages/Product/Pricing';
import { Roadmap }   from '@/features/landing/components/footer-pages/Product/Roadmap';
import { Security }  from '@/features/landing/components/footer-pages/Product/Security';

// Footer Pages - Company
import { About }     from '@/features/landing/components/footer-pages/Company/About';
import { Blog }      from '@/features/landing/components/footer-pages/Company/Blog';
import { Careers }   from '@/features/landing/components/footer-pages/Company/Careers';
import { Contact }   from '@/features/landing/components/footer-pages/Company/Contact';

// Footer Pages - Legal
import { PrivacyPolicy }       from '@/features/landing/components/footer-pages/Legal/PrivacyPolicy';
import { TermsOfServices }     from '@/features/landing/components/footer-pages/Legal/TermsOfServices';
import { OWASPCompliance }     from '@/features/landing/components/footer-pages/Legal/OWASPCompliance';
import { CookiePolicy }        from '@/features/landing/components/footer-pages/Legal/CookiePolicy';

// Protected Pages
import { Dashboard }      from '@/features/dashboard/Dashboard';
import { Diary }          from '@/features/appointments/Diary';
import { Clients }        from '@/features/patients/Clients';
import { Contacts }       from '@/features/contacts/Contacts';
import { Reports }        from '@/features/reports/Reports';
import { Manage }         from '@/features/manage/Manage';
import { Setup }          from '@/features/setup/Setup';
import { Profile }        from '@/features/profile/Profile';
import PatientProfileLayout from '@/features/patients/PatientProfileLayout';
import PatientProfilePage from '@/features/patients/PatientProfilePage';
import PatientAppointmentsPage from '@/features/patients/PatientAppointmentsPage';
import PatientCasesNotesPage from '@/features/patients/PatientCasesNotesPage';
import PatientUnassignedNotesPage from '@/features/patients/PatientUnassignedNotesPage';
import PatientDocumentsPage from '@/features/patients/PatientDocumentsPage';
import { PatientCommunicationHistoryPage } from '@/features/patients/PatientCommunicationHistoryPage';
import ClientSettings from '@/features/patients/ClientSettings';
import { PatientProfile } from '@/features/patients/PatientProfile';
import { ClinicMessages } from '@/features/clinic-messages/ClinicMessages';
import { NoteEditor }     from '@/features/clinical-template/pages/NoteEditor';
import { GenerateNewInvoice } from '@/features/billing/generateNewInvoice';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { FloatingNotificationsContainer } from '@/features/notifications/components/FloatingNotificationsContainer';
import { FeatureAccessGuard } from '@/components/auth/FeatureAccessGuard';

// ── NEW: Clinic Setup ─────────────────────────────────────────────────────────
import { ClinicSetupPage } from '@/features/clinic-setup/ClinicSetupPage';

// ─── Routes where internal components should NOT appear ────────────────────────────
const PUBLIC_PATHS = ['/login', '/register', '/portal', '/clinic-setup', '/book', '/client-form', '/public'];

const ClinicMessagesGuard = () => {
  const location = useLocation();
  const isHidden = PUBLIC_PATHS.some(p => location.pathname.startsWith(p));
  if (isHidden) return null;
  return <ClinicMessages />;
};

const NotificationBellGuard = () => {
  const { isAuthenticated } = useAuthStore();
  const location            = useLocation();
  const isPublicPage        = PUBLIC_PATHS.some(p => location.pathname.startsWith(p));
  if (!isAuthenticated || isPublicPage) return null;
  return <NotificationBell />;
};

const FloatingNotificationsGuard = () => {
  const location = useLocation();
  const isPublicPage = PUBLIC_PATHS.some(p => location.pathname.startsWith(p));
  if (isPublicPage) return null;
  return <FloatingNotificationsContainer />;
};

const GlobalLogoutModal = () => {
  const { isOpen, close } = useLogoutConfirm();
  const { logout }        = useAuthStore();
  const [showSuccess, setShowSuccess] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleConfirm = () => {
    close();
    logout();
    setShowSuccess(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShowSuccess(false), 4000);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <>
      <LogoutConfirmModal isOpen={isOpen} onConfirm={handleConfirm} onCancel={close} />

      {/* ── Logout success notification ── */}
      <div
        className={`fixed top-5 right-5 z-99999 transition-all duration-500 ${
          showSuccess ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3 pointer-events-none'
        }`}
      >
        <div className="flex items-start gap-3 bg-white rounded-2xl shadow-2xl border border-gray-100 px-5 py-4 min-w-70 max-w-sm">
          {/* Indicator lights */}
          <div className="flex flex-col items-center gap-1.5 pt-0.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="w-2 h-2 rounded-full bg-emerald-300" />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-100" />
          </div>

          {/* Message */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 leading-snug">Logged out successfully</p>
            <p className="text-xs text-gray-500 mt-0.5">You have been securely signed out of Malasakit.</p>
          </div>

          {/* Close */}
          <button
            onClick={() => setShowSuccess(false)}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
            aria-label="Dismiss"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Auto-dismiss progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full overflow-hidden">
          <div
            className={`h-full bg-emerald-400 origin-left ${
              showSuccess ? 'animate-[shrink_4s_linear_forwards]' : ''
            }`}
            style={showSuccess ? { animation: 'shrink 4s linear forwards' } : {}}
          />
        </div>
      </div>
    </>
  );
};

/** Inactivity guard — renders the session-expiry warning modal when the user
 *  has been idle for nearly 2 hours, and logs them out on timeout. */
const SessionGuard = () => {
  const { logout }                           = useAuthStore();
  const { showWarning, remainingMs, stayLoggedIn } = useInactivityLogout();
  return (
    <SessionExpiryWarningModal
      showWarning={showWarning}
      remainingMs={remainingMs}
      onStayLoggedIn={stayLoggedIn}
      onLogout={logout}
    />
  );
};

const Unauthorized = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <h1 className="text-4xl font-bold text-red-600">403</h1>
      <p className="text-gray-600 mt-2">You don't have permission to access this page</p>
    </div>
  </div>
);

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-sky-50 to-blue-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-sky-600 mx-auto mb-4"></div>
      <p className="text-gray-600 text-lg font-medium">Loading...</p>
    </div>
  </div>
);

function App() {
  const { verifyAuth }       = useAuthStore();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      await verifyAuth();
      setIsInitializing(false);
    };
    initAuth();
  }, [verifyAuth]);

  if (isInitializing) return <LoadingScreen />;

  return (
    <SidebarProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#fff', color: '#363636',
              padding: '16px', borderRadius: '12px',
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
            },
            success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />

        <Routes>
          {/* ── Public ─────────────────────────────────────────────── */}
          <Route path="/"                 element={<PublicRoute><LandingPage /></PublicRoute>} />
          <Route path="/login"            element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register"         element={<PublicRoute><AdminRegister /></PublicRoute>} />
          <Route path="/register/success" element={<PublicRoute><RegisterSuccess /></PublicRoute>} />
          <Route
            path="/register/set-password"
            element={
              <OnboardingPasswordRoute>
                <SetOnboardingPasswordPage />
              </OnboardingPasswordRoute>
            }
          />
          <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
          <Route path="/forgot-password/otp" element={<PublicRoute><ForgotPasswordOTP /></PublicRoute>} />
          <Route
            path="/reset-password"
            element={
              <ResetPasswordRoute>
                <ResetPasswordPage />
              </ResetPasswordRoute>
            }
          />

          {/* ── Mandatory first-login password change ───────────────── */}
          <Route
            path="/change-password"
            element={
              <ChangePasswordRoute>
                <ChangePasswordPage />
              </ChangePasswordRoute>
            }
          />

          {/* ── Footer Pages - Product ──────────────────────────────── */}
          <Route path="/features"  element={<PublicRoute><Features /></PublicRoute>} />
          <Route path="/pricing"   element={<PublicRoute><Pricing /></PublicRoute>} />
          <Route path="/roadmap"   element={<PublicRoute><Roadmap /></PublicRoute>} />
          <Route path="/security"  element={<PublicRoute><Security /></PublicRoute>} />

          {/* ── Footer Pages - Company ──────────────────────────────── */}
          <Route path="/about"     element={<PublicRoute><About /></PublicRoute>} />
          <Route path="/blog"      element={<PublicRoute><Blog /></PublicRoute>} />
          <Route path="/careers"   element={<PublicRoute><Careers /></PublicRoute>} />
          <Route path="/contact"   element={<PublicRoute><Contact /></PublicRoute>} />

          {/* ── Footer Pages - Legal ────────────────────────────────── */}
          <Route path="/privacy-policy"    element={<PublicRoute><PrivacyPolicy /></PublicRoute>} />
          <Route path="/terms-of-service"  element={<PublicRoute><TermsOfServices /></PublicRoute>} />
          <Route path="/owasp-compliance"  element={<PublicRoute><OWASPCompliance /></PublicRoute>} />
          <Route path="/cookie-policy"     element={<PublicRoute><CookiePolicy /></PublicRoute>} />

          {/* ── Patient Portal ──────────────────────────────────────── */}
          <Route path="/book/:token"         element={<PortalHome />} />
          <Route path="/book/:token/success" element={<BookAppointmentSuccess />} />
          <Route path="/book"                element={<PortalHome />} />
          
          {/* Legacy Fallbacks */}
          <Route path="/portal/:token"         element={<PortalHome />} />
          <Route path="/portal/:token/success" element={<BookAppointmentSuccess />} />
          {/* ── Public Client Form ──────────────────────────────────── */}
          <Route path="/client-form/:token" element={<ClientFormPublicPage />} />
          {/* ── Rebooking (DNA follow-up secure link) ───────────────── */}
          <Route path="/rebook/:token" element={<RebookPage />} />
          {/* ── Email appointment confirmation ───────────────────────── */}
          <Route path="/confirm/:token" element={<AppointmentConfirmPage />} />
          {/* ── Clinic Setup (first-login admin only) ───────────────── */}
          <Route
            path="/clinic-setup"
            element={
              <ClinicSetupRoute>
                <ClinicSetupPage />
              </ClinicSetupRoute>
            }
          />

          {/* ── Misc ────────────────────────────────────────────────── */}
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* ── Protected ───────────────────────────────────────────── */}
          <Route path="/dashboard" element={<ProtectedRoute><FeatureAccessGuard feature="dashboard" featureLabel="Dashboard"><Dashboard /></FeatureAccessGuard></ProtectedRoute>} />
          <Route path="/diary"     element={<ProtectedRoute><FeatureAccessGuard feature="diary" featureLabel="Diary"><Diary /></FeatureAccessGuard></ProtectedRoute>} />
          <Route path="/clients"   element={<ProtectedRoute><FeatureAccessGuard feature="patients" featureLabel="Clients"><Clients /></FeatureAccessGuard></ProtectedRoute>} />
          <Route path="/contacts"  element={<ProtectedRoute><FeatureAccessGuard feature="contacts" featureLabel="Contacts"><Contacts /></FeatureAccessGuard></ProtectedRoute>} />
          <Route path="/reports"   element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/profile"   element={<ProtectedRoute><Profile /></ProtectedRoute>} />

          <Route
            path="/patients/:patientId"
            element={<ProtectedRoute><FeatureAccessGuard feature="patients" featureLabel="Clients"><PatientProfileLayout /></FeatureAccessGuard></ProtectedRoute>}
          >
            <Route index element={<Navigate to="profile" replace />} />
            <Route path="profile" element={<PatientProfilePage />} />
            <Route path="appointments" element={<PatientAppointmentsPage />} />
            <Route path="cases" element={<PatientCasesNotesPage />} />
            <Route path="unassigned-notes" element={<PatientUnassignedNotesPage />} />
            <Route path="notes" element={<Navigate to="../cases" replace />} />
            <Route path="documents" element={<PatientDocumentsPage />} />
            <Route path="communications" element={<PatientCommunicationHistoryPage />} />
            <Route path="settings"  element={<ClientSettings />} />
          </Route>

          <Route path="/clients/:id"         element={<ProtectedRoute><PatientProfile /></ProtectedRoute>} />

          <Route path="/clinical-notes"         element={<ProtectedRoute><NoteEditor /></ProtectedRoute>} />
          <Route path="/clinical-notes/:noteId" element={<ProtectedRoute><NoteEditor /></ProtectedRoute>} />

          <Route path="/billing/generate-invoice/:appointmentId" element={<ProtectedRoute><GenerateNewInvoice /></ProtectedRoute>} />

          <Route path="/manage" element={<ClinicMemberRoute><Manage /></ClinicMemberRoute>} />
          <Route path="/setup"  element={<ClinicMemberRoute><Setup /></ClinicMemberRoute>} />

          {/* ── 404 ─────────────────────────────────────────────────── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <ClinicMessagesGuard />
        <NotificationBellGuard />
        <FloatingNotificationsGuard />
        <GlobalLogoutModal />
        <SessionGuard />
        <Analytics />
      </BrowserRouter>
    </SidebarProvider>
  );
}

export default App;