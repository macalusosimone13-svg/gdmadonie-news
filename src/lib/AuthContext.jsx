import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

const AuthContext = createContext();

// Versione Supabase del contesto di autenticazione. Mantiene la stessa forma
// (user, isAuthenticated, isLoadingAuth, authChecked, authError, logout,
// navigateToLogin, checkUserAuth) usata da ProtectedRoute/App.jsx, così non
// serve toccare quei file: il concetto Base44 di "app pubblica/utente non
// registrato" semplicemente non esiste più con Supabase (chiunque può
// registrarsi), quindi authError resta sempre null.
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  const loadUser = useCallback(async (session) => {
    if (!session?.user) {
      setUser(null);
      setIsAuthenticated(false);
      return;
    }
    let profile = null;
    try {
      const { data } = await supabase.from('profiles').select('role, image_url').eq('id', session.user.id).single();
      profile = data;
    } catch {
      // profilo non ancora creato (trigger in corso) — si aggiorna al prossimo giro
    }
    setUser({
      id: session.user.id,
      email: session.user.email,
      full_name: session.user.user_metadata?.full_name || session.user.email,
      role: profile?.role || 'user',
      image_url: profile?.image_url || null
    });
    setIsAuthenticated(true);
  }, []);

  const checkUserAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await loadUser(session);
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, [loadUser]);

  useEffect(() => {
    checkUserAuth();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      loadUser(session);
      setAuthChecked(true);
      setIsLoadingAuth(false);
    });
    return () => sub.subscription.unsubscribe();
  }, [checkUserAuth, loadUser]);

  const logout = () => {
    supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError: null,
      appPublicSettings: null,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState: checkUserAuth
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
