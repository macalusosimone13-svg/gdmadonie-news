import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import React, { Suspense, lazy } from 'react';
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


// Dopo un nuovo rilascio i vecchi file JS cambiano nome: una scheda rimasta
// aperta cerca pezzi che non esistono piu' e resterebbe vuota. Si riprova e,
// se serve, si ricarica la pagina una volta sola per prendere la versione nuova.
const lazyRetry = (factory) => lazy(async () => {
  try {
    const m = await factory();
    try { sessionStorage.removeItem('mn_chunk_reload'); } catch {}
    return m;
  } catch (e) {
    try { await new Promise((r) => setTimeout(r, 600)); return await factory(); } catch (e2) {
      let already = false;
      try { already = sessionStorage.getItem('mn_chunk_reload') === '1'; sessionStorage.setItem('mn_chunk_reload', '1'); } catch {}
      if (!already) { window.location.reload(); return new Promise(() => {}); }
      throw e2;
    }
  }
});

class ChunkErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidUpdate(prev) { if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false }); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center', background: '#FFFDF9', color: '#0F1B3A', fontFamily: 'Figtree, sans-serif' }}>
        <div style={{ fontFamily: 'Rubik, sans-serif', fontWeight: 900, fontSize: 24, textTransform: 'uppercase' }}>Qualcosa non si è caricato</div>
        <p style={{ maxWidth: 320, opacity: .75 }}>La connessione ha avuto un problema. Riprova: di solito basta un secondo.</p>
        <button onClick={() => { try { sessionStorage.removeItem('mn_chunk_reload'); } catch {} window.location.reload(); }} style={{ background: '#2F5BD8', color: '#fff', fontFamily: 'Rubik, sans-serif', fontWeight: 700, padding: '14px 28px', borderRadius: 999 }}>Ricarica</button>
      </div>);
  }
}

const Home = lazyRetry(() => import('@/pages/Home'));
const GDMadonie = lazyRetry(() => import('@/pages/GDMadonie'));
const RassegnaStampa = lazyRetry(() => import('@/pages/RassegnaStampa'));
const PostDetail = lazyRetry(() => import('@/pages/PostDetail'));
const EventDetail = lazyRetry(() => import('@/pages/EventDetail'));
const Admin = lazyRetry(() => import('@/pages/Admin'));
const Assistant = lazyRetry(() => import('@/pages/Assistant'));
const Settings = lazyRetry(() => import('@/pages/Settings'));
const Privacy = lazyRetry(() => import('@/pages/Privacy'));
const Termini = lazyRetry(() => import('@/pages/Termini'));
const TeamMemberDetail = lazyRetry(() => import('@/pages/TeamMemberDetail'));
const ChiSiamo = lazyRetry(() => import('@/pages/ChiSiamo'));
const Sondaggi = lazyRetry(() => import('@/pages/Sondaggi'));

const PageSpinner = () => (
  <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#FFFDF9' }}>
    <div className="w-10 h-10 rounded-full animate-spin" style={{ border: '4px solid #DDE5FB', borderTopColor: '#2F5BD8' }}></div>
  </div>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings) {
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
    <ChunkErrorBoundary resetKey={location.pathname}><Suspense fallback={<PageSpinner />}>
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
    </Suspense></ChunkErrorBoundary>
  );
};


// A pagina caricata, nei tempi morti si scaricano in anticipo le pagine piu'
// usate: quando si tocca una notizia il codice e' gia' li'.
const prefetchRoutes = () => {
  [() => import('@/pages/PostDetail'), () => import('@/pages/RassegnaStampa'), () => import('@/pages/GDMadonie'), () => import('@/pages/Sondaggi'), () => import('@/pages/ChiSiamo')]
    .forEach((f, i) => setTimeout(() => { f().catch(() => {}); }, 400 * (i + 1)));
};

function App() {
  React.useEffect(() => {
    const run = () => prefetchRoutes();
    if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 4000 });
    else setTimeout(run, 2500);
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light" enableSystem={false}>
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
