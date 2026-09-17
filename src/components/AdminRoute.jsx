import { useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { getCurrentUser } from '@/lib/supabaseAuth';

export default function AdminRoute({ children }) {
  const [state, setState] = useState({ loading: true, authed: false, isAdmin: false });

  useEffect(() => {
    getCurrentUser()
      .then((u) => setState({ loading: false, authed: !!u, isAdmin: u?.role === 'admin' || u?.role === 'editor' }))
      .catch(() => setState({ loading: false, authed: false, isAdmin: false }));
  }, []);

  if (state.loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }
  if (!state.authed) return <Navigate to="/login" replace />;
  if (!state.isAdmin) {
    return (
      <div className="text-center py-20 px-4">
        <p className="text-slate-600 mb-4 font-medium">Accesso riservato alla redazione.</p>
        <Link to="/" className="text-primary font-medium underline">Torna alla home</Link>
      </div>
    );
  }
  return children;
}
