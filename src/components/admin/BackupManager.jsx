import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Download, Loader2, ShieldCheck } from 'lucide-react';

export default function BackupManager() {
  const [downloading, setDownloading] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const downloadBackup = async () => {
    setDownloading(true);
    setLastResult(null);
    try {
      const [posts, events, polls, subscribers, socialLinks] = await Promise.all([
      base44.entities.Post.list('-created_date', 2000).catch(() => []),
      base44.entities.Event.list('-date', 1000).catch(() => []),
      base44.entities.PollEntry.list('-survey_date', 2000).catch(() => []),
      base44.entities.NewsletterSubscriber.list('-subscribed_date', 5000).catch(() => []),
      base44.entities.SocialLink.list('sort_order', 50).catch(() => [])]
      );
      const backup = {
        exported_at: new Date().toISOString(),
        counts: { posts: posts.length, events: events.length, poll_entries: polls.length, newsletter_subscribers: subscribers.length, social_links: socialLinks.length },
        posts,
        events,
        poll_entries: polls,
        newsletter_subscribers: subscribers,
        social_links: socialLinks
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gdmadonie-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setLastResult(backup.counts);
    } catch {
      setLastResult({ error: true });
    }
    setDownloading(false);
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-foreground">Copia di sicurezza</h3>
          <p className="text-sm text-muted-foreground mt-1">Scarica un file con tutti i comunicati, eventi, sondaggi, iscritti alla newsletter e contatti social attuali. Utile da tenere da parte: se qualcosa viene cancellato o modificato per errore, qui trovi i dati per reinserirli a mano — non è un ripristino automatico.</p>
        </div>
      </div>
      <button onClick={downloadBackup} disabled={downloading} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-medium disabled:opacity-60">
        {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Scarica backup (JSON)
      </button>
      {lastResult && !lastResult.error &&
      <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg p-3">
          Scaricato: {lastResult.posts} post, {lastResult.events} eventi, {lastResult.poll_entries} righe di sondaggi, {lastResult.newsletter_subscribers} iscritti, {lastResult.social_links} contatti social.
        </p>
      }
      {lastResult?.error &&
      <p className="text-sm text-red-700 bg-red-50 rounded-lg p-3">Qualcosa non ha funzionato, riprova.</p>
      }
    </div>);

}
