import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { sb44 } from '@/api/supabaseEntities';
import { supabase } from '@/lib/supabaseClient';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { RefreshCw, Trash2, Loader2, FileText, Calendar, Download, Users, Send, Film, Pencil } from 'lucide-react';
import PostForm, { FramePicker } from '@/components/admin/PostForm';
import EventForm from '@/components/admin/EventForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import SocialLinksManager from '@/components/admin/SocialLinksManager';
import ExecutionLogViewer from '@/components/admin/ExecutionLogViewer';
import TestataManager from '@/components/admin/TestataManager';
import SplashConfigManager from '@/components/admin/SplashConfigManager';
import ContentTextManager from '@/components/admin/ContentTextManager';
import EmailTemplateManager from '@/components/admin/EmailTemplateManager';
import CodeExporter from '@/components/admin/CodeExporter';
import UxDesignManager from '@/components/admin/UxDesignManager';
import StoryShareConfigManager from '@/components/admin/StoryShareConfigManager';
import PollManager from '@/components/admin/PollManager';
import PollShareConfigManager from '@/components/admin/PollShareConfigManager';
import CoalitionGroupManager from '@/components/admin/CoalitionGroupManager';
import BackupManager from '@/components/admin/BackupManager';
import { CATEGORIES } from '@/lib/categories';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

export default function Admin() {
  const [posts, setPosts] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState(null);
  const [regs, setRegs] = useState([]);
  const [loadingRegs, setLoadingRegs] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [pickingPosterId, setPickingPosterId] = useState(null);
  const [editingPost, setEditingPost] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);

  const loadRegs = () => {
    setLoadingRegs(true);
    base44.entities.EventRegistration.list('-created_date', 500).then((data) => setRegs(data || [])).catch(() => setRegs([])).finally(() => setLoadingRegs(false));
  };

  const downloadRegCSV = () => {
    const headers = ['Evento', 'Data evento', 'Nome', 'Email', 'Note', 'Data iscrizione'];
    const rows = regs.map((r) => [
    r.event_title || '',
    r.event_date ? format(new Date(r.event_date), 'dd/MM/yyyy HH:mm', { locale: it }) : '',
    r.name || '',
    r.email || '',
    (r.notes || '').replace(/[\r\n]+/g, ' '),
    r.created_date ? format(new Date(r.created_date), 'dd/MM/yyyy HH:mm', { locale: it }) : '']
    );
    const csv = [headers, ...rows].
    map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')).
    join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'iscrizioni_eventi.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const load = () => {
    setLoading(true);
    Promise.all([
    sb44.entities.Post.filter({ source_type: 'gd_madonie' }, '-created_date', 30),
    sb44.entities.Event.list('-date', 30)]
    ).then(([p, e]) => {setPosts(p || []);setEvents(e || []);setLoading(false);}).catch(() => setLoading(false));
  };

  useEffect(() => {load();}, []);

  const deletePost = (id) => setPendingDelete({ type: 'post', id });
  const deleteEvent = (id) => setPendingDelete({ type: 'event', id });

  const confirmDeleteAction = async () => {
    if (!pendingDelete) return;
    const { type, id } = pendingDelete;
    try {
      if (type === 'post') {
        await sb44.entities.Post.delete(id);
        setPosts((prev) => prev.filter((p) => p.id !== id));
      } else {
        await sb44.entities.Event.delete(id);
        setEvents((prev) => prev.filter((e) => e.id !== id));
      }
    } catch (e) {}
    setPendingDelete(null);
  };

  const publishPost = async (id) => {
    await sb44.entities.Post.update(id, { status: 'published' });
    setPosts((prev) => prev.map((p) => p.id === id ? { ...p, status: 'published' } : p));
  };

  const savePoster = async (post, posterUrl) => {
    const patch = { poster_url: posterUrl };
    if (post.media && post.media.length) {
      patch.media = post.media.map((m, i) => i === 0 ? { ...m, poster_url: posterUrl } : m);
    }
    await sb44.entities.Post.update(post.id, patch);
    setPosts((prev) => prev.map((p) => p.id === post.id ? { ...p, ...patch } : p));
    setPickingPosterId(null);
  };

  const refreshRSS = async () => {
    setRefreshing(true);setRefreshResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('aggregate-rss', {});
      if (error) throw error;
      setRefreshResult(data);load();
    } catch (e) {setRefreshResult({ error: e.message });}
    setRefreshing(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Area Admin</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Pubblica e gestisci i contenuti del circolo</p>
      </div>
      <Tabs defaultValue="post">
        <TabsList className="w-full flex overflow-x-auto scrollbar-hide bg-muted p-1 h-auto rounded-full">
          <TabsTrigger value="post" className="flex-1 text-xs py-2.5 min-h-[44px] rounded-full">Nuovo Post</TabsTrigger>
          <TabsTrigger value="event" className="flex-1 text-xs py-2.5 min-h-[44px] rounded-full">Nuovo Evento</TabsTrigger>
          <TabsTrigger value="manage" className="flex-1 text-xs py-2.5 min-h-[44px] rounded-full">Gestisci</TabsTrigger>
          <TabsTrigger value="rss" className="flex-1 text-xs py-2.5 min-h-[44px] rounded-[999px]">Rassegna RSS</TabsTrigger>
          <TabsTrigger value="contatti" className="flex-1 text-xs py-2.5 min-h-[44px]">Contatti</TabsTrigger>
          <TabsTrigger value="log" className="flex-1 text-xs py-2.5 min-h-[44px] rounded-full">Log</TabsTrigger>
          <TabsTrigger value="splash" className="flex-1 text-xs py-2.5 min-h-[44px]">Splash</TabsTrigger>
          <TabsTrigger value="testi" className="flex-1 text-xs py-2.5 min-h-[44px] rounded-full">Testi</TabsTrigger>
          <TabsTrigger value="email" className="flex-1 text-xs py-2.5 min-h-[44px] rounded-full">Email</TabsTrigger>
          <TabsTrigger value="ux" className="flex-1 text-xs py-2.5 min-h-[44px] rounded-full">Design UX</TabsTrigger>
          <TabsTrigger value="storia" className="flex-1 text-xs py-2.5 min-h-[44px] rounded-full">Storia IG</TabsTrigger>
          <TabsTrigger value="sondaggi" className="flex-1 text-xs py-2.5 min-h-[44px] rounded-full">Sondaggi</TabsTrigger>
          <TabsTrigger value="coalizioni" className="flex-1 text-xs py-2.5 min-h-[44px] rounded-full">Coalizioni</TabsTrigger>
          <TabsTrigger value="sondaggi-storia" className="flex-1 text-xs py-2.5 min-h-[44px] rounded-full">Storia Sondaggi</TabsTrigger>
          <TabsTrigger value="iscrizioni" className="flex-1 text-xs py-2.5 min-h-[44px] rounded-full">Iscrizioni</TabsTrigger>
          <TabsTrigger value="codice" className="flex-1 text-xs py-2.5 min-h-[44px] rounded-full">Codice</TabsTrigger>
          <TabsTrigger value="backup" className="flex-1 text-xs py-2.5 min-h-[44px] rounded-full">Backup</TabsTrigger>
        </TabsList>
        <TabsContent value="post" className="mt-4"><PostForm onCreated={load} /></TabsContent>
        <TabsContent value="event" className="mt-4"><EventForm onCreated={load} /></TabsContent>
        <TabsContent value="manage" className="mt-4 space-y-5">
          <div>
            <h3 className="font-semibold text-foreground mb-2 text-sm">Post ({posts.length})</h3>
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : posts.length === 0 ? <p className="text-sm text-muted-foreground">Nessun post.</p> :
            <div className="space-y-2">
                {posts.map((p) =>
              <div key={p.id} className="bg-card border border-border rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.title}</p>
                        <p className="text-xs text-muted-foreground">{CATEGORIES[p.category]?.label}</p>
                      </div>
                      {p.status === 'draft' && <span className="text-xs font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Bozza</span>}
                      {p.status === 'draft' && <button onClick={() => publishPost(p.id)} aria-label="Pubblica ora" title="Pubblica ora" className="text-primary hover:text-primary/80 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"><Send className="w-4 h-4" /></button>}
                      {p.media_type === 'video' &&
                  <button onClick={() => setPickingPosterId(pickingPosterId === p.id ? null : p.id)} aria-label="Scegli copertina video" title="Scegli copertina video" className="text-muted-foreground hover:text-primary p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"><Film className="w-4 h-4" /></button>
                  }
                      <button onClick={() => setEditingPost(p)} aria-label="Modifica post" title="Modifica" className="text-muted-foreground hover:text-primary p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => deletePost(p.id)} aria-label="Elimina post" className="text-red-500 hover:text-red-700 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    {pickingPosterId === p.id &&
                <FramePicker url={p.image_url} onPick={(url) => savePoster(p, url)} onCancel={() => setPickingPosterId(null)} />
                }
                  </div>
              )}
              </div>
            }
          </div>
          <div>
            <h3 className="font-semibold text-foreground mb-2 text-sm">Eventi ({events.length})</h3>
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : events.length === 0 ? <p className="text-sm text-muted-foreground">Nessun evento.</p> :
            <div className="space-y-2">
                {events.map((ev) =>
              <div key={ev.id} className="flex items-center gap-2 bg-card border border-border rounded-xl p-3">
                    <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{ev.title}</p>
                      <p className="text-xs text-muted-foreground">{ev.date ? format(new Date(ev.date), 'dd MMM yyyy', { locale: it }) : ''} {ev.location ? '· ' + ev.location : ''}</p>
                    </div>
                    <button onClick={() => setEditingEvent(ev)} aria-label="Modifica evento" title="Modifica" className="text-muted-foreground hover:text-primary p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => deleteEvent(ev.id)} aria-label="Elimina evento" className="text-red-500 hover:text-red-700 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
                  </div>
              )}
              </div>
            }
          </div>
        </TabsContent>
        <TabsContent value="rss" className="mt-4 space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-semibold text-foreground mb-1">Aggregazione RSS</h3>
            <p className="text-sm text-muted-foreground mb-4">Importa le ultime notizie politiche da ANSA, Repubblica, Il Fatto, testate siciliane e del territorio madonita. Le testate con sezione Politica dedicata usano il feed di categoria; le altre vengono filtrate per tema.</p>
            <button onClick={refreshRSS} disabled={refreshing} aria-label="Importa feed RSS" className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-medium disabled:opacity-60">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Importa ora
            </button>
            {refreshResult &&
            <div className={`mt-4 text-sm rounded-lg p-3 ${refreshResult.error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                {refreshResult.error ? 'Errore: ' + refreshResult.error :
              <div>Nuovi articoli importati:
                    <ul className="mt-1 space-y-0.5">{(refreshResult.results || []).map((r, i) => <li key={i}>• {r.source}: {r.added ?? r.error} nuovi</li>)}</ul>
                  </div>}
              </div>
            }
          </div>
          <TestataManager />
        </TabsContent>
        <TabsContent value="contatti" className="mt-4"><SocialLinksManager /></TabsContent>
        <TabsContent value="log" className="mt-4"><ExecutionLogViewer /></TabsContent>
        <TabsContent value="splash" className="mt-4"><SplashConfigManager /></TabsContent>
        <TabsContent value="testi" className="mt-4"><ContentTextManager /></TabsContent>
        <TabsContent value="email" className="mt-4"><EmailTemplateManager /></TabsContent>
        <TabsContent value="ux" className="mt-4"><UxDesignManager /></TabsContent>
        <TabsContent value="storia" className="mt-4"><StoryShareConfigManager /></TabsContent>
        <TabsContent value="sondaggi" className="mt-4"><PollManager /></TabsContent>
        <TabsContent value="coalizioni" className="mt-4"><CoalitionGroupManager /></TabsContent>
        <TabsContent value="sondaggi-storia" className="mt-4"><PollShareConfigManager /></TabsContent>
        <TabsContent value="iscrizioni" className="mt-4 space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-foreground">Iscrizioni agli eventi ({regs.length})</h3>
                <p className="text-sm text-muted-foreground">Elenco completo dei partecipanti registrati.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={loadRegs} disabled={loadingRegs} aria-label="Aggiorna elenco iscrizioni" className="flex items-center gap-1.5 text-sm border border-border px-3 py-2.5 min-h-[44px] rounded-lg hover:bg-muted">
                  <RefreshCw className={`w-4 h-4 ${loadingRegs ? 'animate-spin' : ''}`} /> Aggiorna
                </button>
                <button onClick={downloadRegCSV} disabled={!regs.length} aria-label="Scarica CSV iscrizioni" className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-3 py-2.5 min-h-[44px] rounded-lg disabled:opacity-50">
                  <Download className="w-4 h-4" /> Scarica CSV
                </button>
              </div>
            </div>
            {regs.length === 0 && !loadingRegs ?
            <p className="text-sm text-muted-foreground text-center py-6">Nessuna iscrizione. Clicca "Aggiorna" per caricare l'elenco.</p> :
            loadingRegs ?
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div> :

            <div className="space-y-2">
                {regs.map((r) =>
              <div key={r.id} className="flex items-center gap-3 bg-muted border border-border rounded-xl p-3">
                    <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{r.name || '—'} <span className="text-muted-foreground font-normal">· {r.email || ''}</span></p>
                      <p className="text-xs text-muted-foreground truncate">{r.event_title || 'Evento'}{r.event_date ? ' · ' + format(new Date(r.event_date), 'dd MMM yyyy HH:mm', { locale: it }) : ''}</p>
                      {r.notes && <p className="text-xs text-muted-foreground truncate mt-0.5">Note: {r.notes}</p>}
                    </div>
                  </div>
              )}
              </div>
            }
          </div>
        </TabsContent>
        <TabsContent value="codice" className="mt-4"><CodeExporter /></TabsContent>
        <TabsContent value="backup" className="mt-4"><BackupManager /></TabsContent>
      </Tabs>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => {if (!open) setPendingDelete(null);}}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare definitivamente?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.type === 'post' ? 'Il post verrà rimosso e non sarà più visibile.' : 'L\'evento verrà rimosso e non sarà più visibile.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteAction} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editingPost} onOpenChange={(open) => {if (!open) setEditingPost(null);}}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Modifica post</DialogTitle></DialogHeader>
          {editingPost && <PostForm key={editingPost.id} editPost={editingPost} onSaved={() => {setEditingPost(null);load();}} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingEvent} onOpenChange={(open) => {if (!open) setEditingEvent(null);}}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Modifica evento</DialogTitle></DialogHeader>
          {editingEvent && <EventForm key={editingEvent.id} editEvent={editingEvent} onSaved={() => {setEditingEvent(null);load();}} />}
        </DialogContent>
      </Dialog>
    </div>);

}
