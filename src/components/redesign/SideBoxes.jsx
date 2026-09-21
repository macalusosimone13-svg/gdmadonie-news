import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Instagram, Facebook, Twitter, Youtube, Globe, Send, Link as LinkIcon, Share2, Mail } from 'lucide-react';
import { sb44 } from '@/api/supabaseEntities';

const SOCIAL_ICONS = { instagram: Instagram, facebook: Facebook, telegram: Send, twitter: Twitter, youtube: Youtube, website: Globe, email: Mail, custom: LinkIcon };

export function Newsletter() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle');
  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || status === 'saving') return;
    setStatus('saving');
    try {
      const res = await fetch('/functions/subscribeNewsletter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim().toLowerCase() }) });
      if (!res.ok) throw new Error('failed');
      setStatus('done');
    } catch { setStatus('error'); }
  };
  return (
    <div className="side-box">
      <div className="side-title">Iscriviti alla newsletter</div>
      <div style={{ fontSize: 13.5, opacity: .7, lineHeight: 1.45 }}>Ti scriviamo solo quando pubblichiamo un nuovo comunicato o c'è un evento in programma.</div>
      {status === 'done' ?
      <p className="msg ok">Controlla la tua email per confermare!</p> :
      <form onSubmit={submit}>
          <input className="nl-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="La tua email" />
          <button className="nl-btn" type="submit" disabled={status === 'saving'}>{status === 'saving' ? 'Invio…' : 'Iscrivimi'}</button>
          {status === 'error' && <p className="msg err">Qualcosa non ha funzionato, riprova.</p>}
        </form>}
    </div>);
}

export function useGdStats() {
  return useQuery({
    queryKey: ['gd-stats'],
    queryFn: async () => {
      const [comunicati, eventi] = await Promise.all([
      sb44.entities.Post.filter({ status: 'published', source_type: 'gd_madonie' }, '-published_date', 200),
      sb44.entities.Event.list('-date', 200)]);
      return { comunicati: comunicati.length, eventi: eventi.length };
    },
    staleTime: 10 * 60 * 1000
  });
}

export function FollowStats({ withStats = true }) {
  const [state, setState] = useState('idle');
  const { data: links } = useQuery({
    queryKey: ['gd-social-links'],
    queryFn: () => sb44.entities.SocialLink.filter({ is_active: true }, 'sort_order', 10),
    staleTime: 10 * 60 * 1000
  });
  const { data: stats } = useGdStats();
  const share = async () => {
    const url = window.location.origin;
    if (navigator.share) { try { await navigator.share({ title: 'Madonie News', url }); return; } catch (e) { if (e?.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(url); setState('copied'); } catch { setState('error'); }
    setTimeout(() => setState('idle'), 2000);
  };
  const hasLinks = links && links.length > 0;
  const hasStats = withStats && stats && (stats.comunicati > 0 || stats.eventi > 0);
  if (!hasLinks && !hasStats) return null;
  return (
    <>
      {hasLinks &&
      <div className="side-box">
          <div className="side-title">Seguici</div>
          <div className="socials">
            {links.map((l) => {
            const Icon = SOCIAL_ICONS[l.icon] || SOCIAL_ICONS[l.platform] || LinkIcon;
            return <a key={l.id} className="soc" href={l.url} target="_blank" rel="noopener noreferrer" aria-label={l.label || l.platform}><Icon size={17} /></a>;
          })}
            <button type="button" className="soc" onClick={share} aria-label="Condividi il sito" title="Condividi il sito"><Share2 size={17} /></button>
          </div>
          {state === 'copied' && <p className="msg ok">Link copiato!</p>}
          {state === 'error' && <p className="msg err">Non sono riuscito a copiare il link.</p>}
        </div>}
      {hasStats &&
      <div className="side-box"><div className="counters"><div><b>{stats.comunicati}</b><span>Comunicati</span></div><div><b>{stats.eventi}</b><span>Eventi</span></div></div></div>}
    </>);
}
