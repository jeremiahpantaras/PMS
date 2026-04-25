import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from '@/store/auth.store';
import { SidebarProvider } from '@/contexts/SidebarContext';
import { ProtectedRoute, PublicRoute, ClinicMemberRoute, ClinicSetupRoute } from './router';
import { LogoutConfirmModal } from '@/components/modals/LogoutConfirmModal';
import { useLogoutConfirm } from '@/hooks/useLogoutConfirm';

//vercel web analytics
import { Analytics } from "@vercel/analytics/react";

// Public Pages
import { LandingPage }            from '@/features/landing/LandingPage';
import { Login }                  from '@/features/auth/Login';
import { AdminRegister }          from '@/features/auth/AdminRegister';
import { RegisterSuccess }        from '@/features/auth/RegisterSuccess';
import { ForgotPassword }         from '@/features/auth/ForgotPassword';
import { PortalHome }             from '@/features/patient-portal/pages/PortalHome';
import { BookAppointmentSuccess } from '@/features/patient-portal/pages/BookAppointmentSuccess';
import { ClientFormPublicPage }   from '@/features/patients/pages/ClientFormPublicPage';
import { RebookPage }             from '@/features/appointments/RebookPage';

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
import ClientSettings from '@/features/patients/ClientSettings';
import { PatientProfile } from '@/features/patients/PatientProfile';
import { ClinicMessages } from '@/features/clinic-messages/ClinicMessages';
import { NoteEditor }     from '@/features/clinical-template/pages/NoteEditor';
import { GenerateNewInvoice } from '@/features/billing/generateNewInvoice';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { FloatingNotificationsContainer } from '@/features/notifications/components/FloatingNotificationsContainer';

// ── NEW: Clinic Setup ─────────────────────────────────────────────────────────
import { ClinicSetupPage } from '@/features/clinic-setup/ClinicSetupPage';

// ─── Routes where ClinicMessages should NOT appear ────────────────────────────
const HIDDEN_MESSAGE_PATHS = ['/portal', '/clinic-setup'];

const ClinicMessagesGuard = () => {
  const location = useLocation();
  const isHidden = HIDDEN_MESSAGE_PATHS.some(p => location.pathname.startsWith(p));
  if (isHidden) return null;
  return <ClinicMessages />;
};

const NotificationBellGuard = () => {
  const { isAuthenticated } = useAuthStore();
  const location            = useLocation();
  const isPublicPage        = ['/login', '/register', '/portal', '/clinic-setup'].some(p =>
    location.pathname.startsWith(p)
  );
  if (!isAuthenticated || isPublicPage) return null;
  return <NotificationBell />;
};

const GlobalLogoutModal = () => {
  const { isOpen, close } = useLogoutConfirm();
  const { logout }        = useAuthStore();
  const handleConfirm = () => { close(); logout(); };
  return <LogoutConfirmModal isOpen={isOpen} onConfirm={handleConfirm} onCancel={close} />;
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
          <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />

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
          <Route path="/portal/:token"         element={<PortalHome />} />
          <Route path="/portal/:token/success" element={<BookAppointmentSuccess />} />
          {/* ── Public Client Form ──────────────────────────────────── */}
          <Route path="/client-form/:token" element={<ClientFormPublicPage />} />
          {/* ── Rebooking (DNA follow-up secure link) ───────────────── */}
          <Route path="/rebook/:token" element={<RebookPage />} />
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
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/diary"     element={<ProtectedRoute><Diary /></ProtectedRoute>} />
          <Route path="/clients"   element={<ProtectedRoute><Clients /></ProtectedRoute>} />
          <Route path="/contacts"  element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
          <Route path="/reports"   element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/profile"   element={<ProtectedRoute><Profile /></ProtectedRoute>} />

          <Route
            path="/patients/:patientId"
            element={<ProtectedRoute><PatientProfileLayout /></ProtectedRoute>}
          >
            <Route index element={<Navigate to="profile" replace />} />
            <Route path="profile" element={<PatientProfilePage />} />
            <Route path="appointments" element={<PatientAppointmentsPage />} />
            <Route path="cases" element={<PatientCasesNotesPage />} />
            <Route path="unassigned-notes" element={<PatientUnassignedNotesPage />} />
            <Route path="notes" element={<Navigate to="../cases" replace />} />
            <Route path="documents" element={<PatientDocumentsPage />} />
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
        <FloatingNotificationsContainer />
        <GlobalLogoutModal />
        <Analytics />
      </BrowserRouter>
    </SidebarProvider>
  );
}

export default App;