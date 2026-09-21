import { useEffect, useState } from 'react';
import { uploadFile } from '@/lib/uploadFile';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { getCurrentUser, updateProfile, logout as supabaseLogout } from '@/lib/supabaseAuth';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, Sun, Moon, Monitor, Camera, X, LogOut, Share2, Facebook, Copy } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useToast } from '@/components/ui/use-toast';
import UserAvatar from '@/components/UserAvatar';

export default function Settings() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
    getCurrentUser().then((u) => setUser(u)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const cropToSquare = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const min = Math.min(img.width, img.height);
        const maxOut = 512;
        const scale = min > maxOut ? maxOut / min : 1;
        const out = Math.round(min * scale);
        const canvas = document.createElement('canvas');
        canvas.width = out;
        canvas.height = out;
        const ctx = canvas.getContext('2d');
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, out, out);
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('Ritaglio fallito'));
          resolve(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.9);
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const uploadImage = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const square = await cropToSquare(file);
      const res = await uploadFile(square);
      await updateProfile({ image_url: res.file_url });
      setUser((u) => ({ ...u, image_url: res.file_url }));
    } catch (e) {
      alert('Upload fallito: ' + (e.message || 'errore sconosciuto'));
    }
    setUploading(false);
  };

  const removeImage = async () => {
    setUploading(true);
    try {
      await updateProfile({ image_url: null });
      setUser((u) => ({ ...u, image_url: null }));
    } catch (e) {
      alert('Impossibile rimuovere l\'immagine');
    }
    setUploading(false);
  };

  const handleSwitchAccount = async () => {
    try {
      await supabaseLogout();
    } catch (e) {}
    window.location.href = '/login';
  };

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const shareText = 'GD Madonie News — L\'app ufficiale dei Giovani Democratici Madonie: notizie, eventi e rassegna stampa.';

  const shareSite = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {await navigator.share({ title: 'GD Madonie News', text: shareText, url: siteUrl });} catch {}
    } else {
      try {await navigator.clipboard.writeText(siteUrl);toast({ description: 'Link copiato negli appunti' });} catch {}
    }
  };

  const copySiteLink = async () => {
    try {
      await navigator.clipboard.writeText(siteUrl);
      toast({ description: 'Link copiato negli appunti' });
    } catch {
      toast({ description: 'Impossibile copiare il link', variant: 'destructive' });
    }
  };

  const handleDelete = async (e) => {
    e.preventDefault();
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke('delete-account', {});
      if (error) throw error;
      await supabaseLogout();
      window.location.href = '/login';
    } catch (e) {
      alert('Errore durante la cancellazione: ' + (e.message || 'errore sconosciuto'));
      setDeleting(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div></div>;

  const themes = [
  { value: 'system', icon: Monitor, label: 'Sistema' },
  { value: 'light', icon: Sun, label: 'Chiaro' },
  { value: 'dark', icon: Moon, label: 'Scuro' }];


  return (
    <div>
      <div className="page-head"><div className="hero-glow" /><div className="wrap-wide">
        <span className="section-kicker">Il tuo account</span>
        <h1>IMPOSTAZIONI</h1><p>Gestisci il tuo account e le preferenze.</p>
      </div></div>
      <div className="wrap" style={{ maxWidth: 820, paddingTop: 36, paddingBottom: 72 }}>
      <div className="space-y-5">

      <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <UserAvatar user={user} src={user?.image_url} size={64} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground truncate">{user?.full_name || 'Utente'}</p>
            <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
            {user?.role && <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 capitalize mt-1 text-[#005eff]">{user.role}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex-1 flex items-center justify-center gap-2 border border-border rounded-xl py-2.5 text-foreground hover:bg-muted transition-colors cursor-pointer min-h-[44px] font-serif font-normal text-base">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            {user?.image_url ? 'Cambia immagine' : 'Aggiungi immagine'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files[0] && uploadImage(e.target.files[0])}
              disabled={uploading} />
            
          </label>
          {user?.image_url &&
          <button
            type="button"
            onClick={removeImage}
            disabled={uploading}
            aria-label="Rimuovi immagine profilo"
            className="flex items-center justify-center w-11 min-h-[44px] border border-border rounded-xl text-muted-foreground hover:bg-muted hover:text-destructive transition-colors">
            
              <X className="w-4 h-4" />
            </button>
          }
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
        <h2 className="text-lg text-foreground mb-3 font-serif font-normal">Tema</h2>
        <div className="flex gap-2">
          {mounted && themes.map(({ value, icon: Icon, label }) =>
          <button
            key={value}
            onClick={() => setTheme(value)}
            aria-label={`Tema ${label}`}
            className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border text-sm font-medium transition-colors min-h-[44px] text-[#005eff] ${theme === value ? "border-primary bg-primary/10" : 'border-border text-muted-foreground hover:bg-muted'}`}>
            
              <Icon className="w-4 h-4" />
              {label}
            </button>
          )}
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground mb-1">Cambia account</h2>
        <p className="text-muted-foreground mb-4 font-serif font-normal text-base">Esci da questo account per accederne con un altro.</p>
        <button
          type="button"
          onClick={handleSwitchAccount}
          className="flex items-center gap-2 border border-border rounded-xl px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors min-h-[44px]">
          <LogOut className="w-4 h-4" /> Esci e cambia account
        </button>
      </div>

      <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground mb-1">Condividi l'app</h2>
        <p className="text-muted-foreground mb-4 font-serif font-normal text-base">Aiutaci a far crescere la community: invita i tuoi amici a usare GD Madonie News.</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={shareSite}
            className="flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-sm font-medium min-h-[44px] hover:bg-primary/90 transition-colors">
            <Share2 className="w-4 h-4" /> Condividi...
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + siteUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-[#25D366] text-white rounded-xl px-4 py-2.5 text-sm font-medium min-h-[44px] hover:opacity-90">
            <Share2 className="w-4 h-4" /> WhatsApp
          </a>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(siteUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-[#1877F2] text-white rounded-xl px-4 py-2.5 text-sm font-medium min-h-[44px] hover:opacity-90">
            <Facebook className="w-4 h-4" /> Facebook
          </a>
          <button
            type="button"
            onClick={copySiteLink}
            className="flex items-center gap-2 border border-border rounded-xl px-4 py-2.5 text-sm font-medium text-foreground min-h-[44px] hover:bg-muted transition-colors">
            <Copy className="w-4 h-4" /> Copia link
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-destructive/30 p-5 shadow-sm bg-[hsl(var(--background))]">
        <h2 className="text-lg text-foreground mb-1 font-serif font-normal">Elimina account</h2>
        <p className="text-muted-foreground mb-4 font-serif font-normal text-base">La cancellazione è definitiva: tutti i tuoi dati associati verranno rimossi e non potrai più accedere con questo account.</p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="flex items-center gap-2 bg-[#ff0000]">
              <Trash2 className="w-4 h-4" /> Elimina account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminare definitivamente l'account?</AlertDialogTitle>
              <AlertDialogDescription>
                Questa azione non può essere annullata. Il tuo account e i dati associati verranno cancellati permanentemente dal sistema.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Annulla</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                
                {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Elimina definitivamente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      </div>
      </div>
    </div>);

}
