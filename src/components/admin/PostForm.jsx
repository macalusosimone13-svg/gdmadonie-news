import { useState } from 'react';
import { uploadFile } from '@/lib/uploadFile';
import { sb44 } from '@/api/supabaseEntities';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Loader2, Check, X, GripVertical, Film } from 'lucide-react';
import { CATEGORIES, GD_CATEGORIES } from '@/lib/categories';
import { useSiteContent } from '@/lib/useSiteContent';
import { compressImage } from '@/lib/imageCompress';

// Scelta manuale del fotogramma di copertina per un video: l'utente scorre
// una barra, il video (in pausa) mostra quel fotogramma, e alla conferma lo
// "cattura" disegnandolo su un canvas e caricandolo come immagine separata.
// Serve perché il primo istante di un video è spesso nero prima che parta.
export function FramePicker({ url, onPick, onCancel }) {
  const videoRef = useState(() => ({ current: null }))[0];
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [capturing, setCapturing] = useState(false);

  const capture = async () => {
    const v = videoRef.current;
    if (!v) return;
    setCapturing(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      canvas.getContext('2d').drawImage(v, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.9));
      const file = new File([blob], 'poster.jpg', { type: 'image/jpeg' });
      const res = await uploadFile(file);
      onPick(res.file_url);
    } catch (e) {
      alert('Impossibile catturare il fotogramma');
    }
    setCapturing(false);
  };

  return (
    <div className="bg-muted/50 rounded-xl p-3 space-y-2">
      <video
        ref={(el) => {videoRef.current = el;}}
        src={url}
        crossOrigin="anonymous"
        muted
        playsInline
        preload="metadata"
        className="w-full max-h-48 rounded-lg bg-black object-contain"
        onLoadedMetadata={(e) => setDuration(e.target.duration)} />

      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.05}
        value={time}
        onChange={(e) => {
          const t = Number(e.target.value);
          setTime(t);
          if (videoRef.current) videoRef.current.currentTime = t;
        }}
        className="w-full accent-primary" />

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Scorri per trovare il fotogramma giusto</p>
        <div className="flex gap-2 shrink-0">
          <button type="button" onClick={onCancel} className="text-xs text-muted-foreground px-2 py-1.5">Annulla</button>
          <button type="button" onClick={capture} disabled={capturing} className="text-xs font-semibold bg-primary text-primary-foreground px-3 py-1.5 rounded-full disabled:opacity-60 flex items-center gap-1.5">
            {capturing && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Usa questo fotogramma
          </button>
        </div>
      </div>
    </div>);

}

export default function PostForm({ onCreated, editPost, onSaved }) {
  const isEdit = !!editPost;
  const [form, setForm] = useState(() => editPost ? {
    title: editPost.title || '',
    excerpt: editPost.excerpt || '',
    content: editPost.content || '',
    category: editPost.category || 'comunicato',
    author: editPost.author || 'GD Madonie',
    external_link: editPost.external_link || '',
    published_date: editPost.published_date ? new Date(editPost.published_date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16)
  } : {
    title: '', excerpt: '', content: '', category: 'comunicato',
    author: 'GD Madonie', external_link: '',
    published_date: new Date().toISOString().slice(0, 16)
  });
  const [mediaItems, setMediaItems] = useState(() =>
  editPost?.media?.length ? editPost.media : editPost?.image_url ? [{ url: editPost.image_url, type: editPost.media_type || 'image', orientation: editPost.media_orientation || 'horizontal', poster_url: editPost.poster_url }] : []
  );
  const [pickingPosterIdx, setPickingPosterIdx] = useState(null);
  const [attachmentUrl, setAttachmentUrl] = useState(editPost?.attachment_url || '');
  const [attachmentName, setAttachmentName] = useState(editPost?.attachment_name || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

  // Elenco autori suggeriti: "GD Madonie" piu' i nomi gia' impostati nelle
  // schede "In evidenza" (si aggiornano da soli se se ne aggiungono altre),
  // per evitare refusi/spazi che poi impediscono di trovare gli articoli di
  // una persona (successo gia' una volta con uno spazio finale nel nome).
  const { data: content } = useSiteContent();
  const teamNames = [1, 2, 3, 4].
  map((i) => content?.[`team_${i}_name`]).
  filter(Boolean);
  const authorOptions = ['GD Madonie', ...teamNames.filter((n) => n !== 'GD Madonie')];
  const isCustomAuthor = !authorOptions.includes(form.author);

  const detectOrientation = (file) => new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    if (file.type.startsWith('video/')) {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.onloadedmetadata = () => {resolve(v.videoWidth >= v.videoHeight ? 'horizontal' : 'vertical');URL.revokeObjectURL(url);};
      v.onerror = () => {URL.revokeObjectURL(url);resolve('horizontal');};
      v.src = url;
    } else {
      const img = new Image();
      img.onload = () => {resolve(img.naturalWidth >= img.naturalHeight ? 'horizontal' : 'vertical');URL.revokeObjectURL(url);};
      img.onerror = () => {URL.revokeObjectURL(url);resolve('horizontal');};
      img.src = url;
    }
  });

  const uploadFiles = async (fileList) => {
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const toUpload = file.type.startsWith('image/') ? await compressImage(file) : file;
        const res = await uploadFile(toUpload);
        const isVideo = file.type.startsWith('video/');
        const orientation = await detectOrientation(file);
        setMediaItems((prev) => [...prev, { url: res.file_url, type: isVideo ? 'video' : 'image', orientation }]);
      }
    } catch (e) {
      alert('Upload fallito');
    }
    setUploading(false);
  };

  const removeItem = (idx) => setMediaItems((prev) => prev.filter((_, i) => i !== idx));
  const moveItem = (idx, dir) => {
    setMediaItems((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };
  const setItemOrientation = (idx, orientation) => setMediaItems((prev) => prev.map((m, i) => i === idx ? { ...m, orientation } : m));
  const setItemPoster = (idx, poster_url) => {setMediaItems((prev) => prev.map((m, i) => i === idx ? { ...m, poster_url } : m));setPickingPosterIdx(null);};

  const submit = async (e, status = 'published') => {
    e.preventDefault();
    if (!form.title) return;
    setSaving(status);
    try {
      const first = mediaItems[0];
      const payload = {
        ...form,
        published_date: form.published_date ? new Date(form.published_date).toISOString() : new Date().toISOString(),
        image_url: first?.url || undefined,
        media_type: first?.type || 'image',
        media_orientation: first?.orientation || 'horizontal',
        poster_url: first?.poster_url || undefined,
        media: mediaItems.length ? mediaItems : undefined,
        attachment_url: attachmentUrl || undefined,
        attachment_name: attachmentName || undefined
      };
      if (isEdit) {
        await sb44.entities.Post.update(editPost.id, payload);
        setDone('published');
        setTimeout(() => setDone(false), 2000);
        onSaved?.();
        setSaving(false);
        return;
      }
      const created = await sb44.entities.Post.create({
        ...payload,
        status,
        source_type: 'gd_madonie'
      });
      if (status === 'published' && created?.id) {
        try {await supabase.functions.invoke('notify-new-post', { body: { post_id: created.id, app_url: window.location.origin } });} catch (e) {}
      }
      setForm({ title: '', excerpt: '', content: '', category: 'comunicato', author: 'GD Madonie', external_link: '', published_date: new Date().toISOString().slice(0, 16) });
      setMediaItems([]);setAttachmentUrl('');setAttachmentName('');
      setDone(status);
      setTimeout(() => setDone(false), 3000);
      onCreated?.();
    } catch (err) {alert('Errore: ' + (err.response?.data?.message || err.message));}
    setSaving(false);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Titolo *</Label>
        <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Titolo del post" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Categoria</Label>
          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {GD_CATEGORIES.map((k) => <SelectItem key={k} value={k}>{CATEGORIES[k].label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Autore</Label>
          <Select value={isCustomAuthor ? '__custom__' : form.author} onValueChange={(v) => setForm({ ...form, author: v === '__custom__' ? '' : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {authorOptions.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              <SelectItem value="__custom__">Altro (scrivi il nome)</SelectItem>
            </SelectContent>
          </Select>
          {isCustomAuthor &&
          <Input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} placeholder="Nome autore" className="mt-1.5" autoFocus />
          }
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Estratto (breve)</Label>
        <Textarea value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} rows={2} placeholder="Riassunto breve..." />
      </div>
      <div className="space-y-1.5">
        <Label>Testo completo</Label>
        <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={6} placeholder="Testo del comunicato..." />
      </div>
      <div className="space-y-1.5">
        <Label>Data pubblicazione</Label>
        <Input type="datetime-local" value={form.published_date} onChange={(e) => setForm({ ...form, published_date: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Galleria (foto e/o video) — puoi caricarne più di uno</Label>
        {mediaItems.length > 0 &&
        <div className="space-y-2">
            {mediaItems.map((m, idx) =>
          <div key={idx} className="space-y-2">
                <div className="flex items-center gap-2 bg-muted/50 rounded-xl p-2">
                  <div className="flex flex-col items-center">
                    <button type="button" onClick={() => moveItem(idx, -1)} disabled={idx === 0} className="text-muted-foreground disabled:opacity-30 px-1 py-0.5" aria-label="Sposta su">▲</button>
                    <GripVertical className="w-3 h-3 text-muted-foreground/50" />
                    <button type="button" onClick={() => moveItem(idx, 1)} disabled={idx === mediaItems.length - 1} className="text-muted-foreground disabled:opacity-30 px-1 py-0.5" aria-label="Sposta giù">▼</button>
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground w-6 text-center">{idx + 1}</span>
                  {m.type === 'video' ?
              m.poster_url ?
              <img src={m.poster_url} alt="" className={`rounded-lg bg-black h-16 ${m.orientation === 'vertical' ? 'aspect-[9/16] object-contain' : 'aspect-video object-cover'}`} /> :

              <video src={m.url} muted playsInline preload="metadata" className={`rounded-lg bg-black h-16 ${m.orientation === 'vertical' ? 'aspect-[9/16] object-contain' : 'aspect-video object-cover'}`} /> :


              <img src={m.url} alt="" className={`rounded-lg bg-slate-100 h-16 object-cover ${m.orientation === 'vertical' ? 'aspect-[9/16]' : 'aspect-video'}`} />
              }
                  <Select value={m.orientation} onValueChange={(v) => setItemOrientation(idx, v)}>
                    <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="horizontal">Orizzontale</SelectItem>
                      <SelectItem value="vertical">Verticale</SelectItem>
                    </SelectContent>
                  </Select>
                  {m.type === 'video' &&
              <button type="button" onClick={() => setPickingPosterIdx(pickingPosterIdx === idx ? null : idx)} className="text-xs font-medium text-primary hover:underline flex items-center gap-1 shrink-0" title="Scegli il fotogramma di copertina">
                      <Film className="w-3.5 h-3.5" /> Copertina
                    </button>
              }
                  <button type="button" onClick={() => removeItem(idx)} className="ml-auto text-red-500 hover:text-red-600 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Rimuovi media"><X className="w-4 h-4" /></button>
                </div>
                {pickingPosterIdx === idx &&
            <FramePicker url={m.url} onPick={(posterUrl) => setItemPoster(idx, posterUrl)} onCancel={() => setPickingPosterIdx(null)} />
            }
              </div>
          )}
            <p className="text-xs text-muted-foreground">Il primo elemento sarà la copertina del post.</p>
          </div>
        }
        <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 dark:border-border rounded-xl py-6 cursor-pointer hover:border-primary text-sm text-slate-500 dark:text-muted-foreground">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {mediaItems.length ? 'Aggiungi altri media' : 'Carica foto o video'}
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => {if (e.target.files?.length) uploadFiles(e.target.files);e.target.value = '';}}
            disabled={uploading} />
          
        </label>
      </div>
      <div className="space-y-1.5">
        <Label>Allegato (PDF / locandina)</Label>
        {attachmentUrl ?
        <div className="flex items-center gap-2 text-sm text-emerald-600">
            <Check className="w-4 h-4" /> {attachmentName}
            <button type="button" onClick={() => {setAttachmentUrl('');setAttachmentName('');}} className="text-red-500 ml-auto"><X className="w-4 h-4" /></button>
          </div> :

        <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 dark:border-border rounded-xl py-6 cursor-pointer hover:border-primary text-sm text-slate-500 dark:text-muted-foreground">
            {uploading === 'attachment' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Carica PDF
            <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => e.target.files[0] && (async () => {setUploading('attachment');try {const res = await uploadFile(e.target.files[0]);setAttachmentUrl(res.file_url);setAttachmentName(e.target.files[0].name);} catch (err) {alert('Upload fallito');}setUploading(false);})()} />
          </label>
        }
      </div>
      <div className="space-y-1.5">
        <Label>Link esterno (opzionale)</Label>
        <Input value={form.external_link} onChange={(e) => setForm({ ...form, external_link: e.target.value })} placeholder="https://..." />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {isEdit ?
        <Button type="submit" disabled={!!saving} className="w-full col-span-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {done ? 'Modifiche salvate!' : 'Salva modifiche'}
          </Button> :

        <>
            <Button type="button" variant="outline" disabled={!!saving} onClick={(e) => submit(e, 'draft')} className="w-full">
              {saving === 'draft' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {done === 'draft' ? 'Bozza salvata!' : 'Salva bozza'}
            </Button>
            <Button type="submit" disabled={!!saving} className="w-full bg-[#ff7124]">
              {saving === 'published' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {done === 'published' ? 'Pubblicato!' : 'Pubblica post'}
            </Button>
          </>
        }
      </div>
    </form>);

}
