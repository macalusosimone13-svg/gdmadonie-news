import { Link } from 'react-router-dom';

// Pagina 404 nel nuovo stile.
export default function PageNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-5 text-center" style={{ background: '#0F1B3A' }}>
      <div style={{ maxWidth: 420 }}>
        <div className="mn-auth-logo" style={{ marginBottom: 34 }}>GD MADONIE<span>NEWS</span></div>
        <div style={{ fontFamily: 'Rubik, sans-serif', fontWeight: 900, fontSize: 'clamp(5rem,26vw,8rem)', lineHeight: .9, color: '#2F5BD8' }}>404</div>
        <h1 style={{ fontFamily: 'Rubik, sans-serif', fontWeight: 900, textTransform: 'uppercase', color: '#fff', fontSize: '1.7rem', margin: '18px 0 10px' }}>Pagina non trovata</h1>
        <p style={{ color: 'rgba(255,255,255,.7)', lineHeight: 1.6 }}>Il link che hai seguito non esiste più oppure è stato spostato.</p>
        <Link to="/" style={{ display: 'inline-block', marginTop: 28, background: '#2F5BD8', color: '#fff', fontFamily: 'Rubik, sans-serif', fontWeight: 700, padding: '14px 30px', borderRadius: 999 }}>Torna al Feed</Link>
      </div>
    </div>
  );
}
