import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { ThemeProvider } from 'next-themes';
import PageNotFound from './lib/PageNotFound';
import SplashScreen from '@/components/SplashScreen';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import Layout from '@/components/Layout';
import AdminRoute from '@/components/AdminRoute';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import { UxConfigProvider } from '@/lib/UxConfigContext';

const Home = lazy(() => import('@/pages/Home'));
const GDMadonie = lazy(() => import('@/pages/GDMadonie'));
const RassegnaStampa = lazy(() => import('@/pages/RassegnaStampa'));
const PostDetail = lazy(() => import('@/pages/PostDetail'));
const EventDetail = lazy(() => import('@/pages/EventDetail'));
const Admin = lazy(() => import('@/pages/Admin'));
const Assistant = lazy(() => import('@/pages/Assistant'));
const Settings = lazy(() => import('@/pages/Settings'));
const Privacy = lazy(() => import('@/pages/Privacy'));
const Termini = lazy(() => import('@/pages/Termini'));
const TeamMemberDetail = lazy(() => import('@/pages/TeamMemberDetail'));
const ChiSiamo = lazy(() => import('@/pages/ChiSiamo'));
const Sondaggi = lazy(() => import('@/pages/Sondaggi'));

const PageSpinner = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
  </div>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return <PageSpinner />;
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes location={location}>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/gd-madonie" element={<GDMadonie />} />
          <Route path="/rassegna-stampa" element={<RassegnaStampa />} />
          <Route path="/rassegna-stampa/:tipo" element={<RassegnaStampa />} />
          <Route path="/assistente" element={<Assistant />} />
          <Route path="/impostazioni" element={<Settings />} />
          <Route path="/post/:id" element={<PostDetail />} />
          <Route path="/articolo/:id" element={<PostDetail />} />
          <Route path="/evento/:id" element={<EventDetail />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/termini" element={<Termini />} />
          <Route path="/in-evidenza/:slot" element={<TeamMemberDetail />} />
          <Route path="/chi-siamo" element={<ChiSiamo />} />
          <Route path="/sondaggi" element={<Sondaggi />} />
          <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
        </Route>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
};


function App() {

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <SplashScreen />
          <Router>
            <ScrollToTop />
            <UxConfigProvider>
              <AuthenticatedApp />
            </UxConfigProvider>
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
