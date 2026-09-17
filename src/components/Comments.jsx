import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { sb44 } from '@/api/supabaseEntities';
import { getCurrentUser } from '@/lib/supabaseAuth';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { MessageCircle, Send, Loader2, Trash2 } from 'lucide-react';

export default function Comments({ postId }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const load = async () => {
    setLoading(true);
    const data = await sb44.entities.Comment.filter({ post_id: postId }, 'created_at', 200);
    setComments(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    getCurrentUser().then(setUser).catch(() => setUser(null));
  }, [postId]);

  const canModerate = user?.role === 'admin' || user?.role === 'editor';

  const send = async () => {
    const content = text.trim();
    if (!content || !user || sending) return;
    setSending(true);
    try {
      const created = await sb44.entities.Comment.create({
        post_id: postId,
        user_id: user.id,
        author_name: user.full_name || user.email,
        content
      });
      setComments((prev) => [...prev, created]);
      setText('');
    } catch {
      alert('Impossibile pubblicare il commento. Riprova.');
    }
    setSending(false);
  };

  const remove = async (id) => {
    if (!confirm('Eliminare questo commento?')) return;
    setDeletingId(id);
    try {
      await sb44.entities.Comment.delete(id);
      setComments((prev) => prev.filter((c) => c.id !== id));
    } catch {
      alert('Impossibile eliminare il commento.');
    }
    setDeletingId(null);
  };

  return (
    <div className="pt-6 mt-6 border-t border-border">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="w-5 h-5 text-muted-foreground" />
        <h2 className="text-base font-semibold text-foreground">
          Commenti {comments.length > 0 && `(${comments.length})`}
        </h2>
      </div>

      {user ? (
        <div className="flex gap-2 items-start mb-5">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Scrivi un commento..."
            rows={2}
            maxLength={2000}
            className="flex-1 resize-none px-3 py-2.5 rounded-2xl border border-border bg-card text-base md:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
          <button
            onClick={send}
            disabled={!text.trim() || sending}
            className="flex-shrink-0 w-10 h-10 rounded-full text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 bg-[#ff7124]"
            aria-label="Invia commento"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground mb-5">
          <Link to="/login" className="text-primary font-medium underline">Accedi</Link> per lasciare un commento.
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ancora nessun commento. Sii il primo a dire la tua.</p>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="bg-card border border-border rounded-2xl p-3.5">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-sm font-semibold text-foreground">{c.author_name}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(c.created_at), 'd MMM yyyy, HH:mm', { locale: it })}
                  </span>
                  {(user?.id === c.user_id || canModerate) && (
                    <button
                      onClick={() => remove(c.id)}
                      disabled={deletingId === c.id}
                      aria-label="Elimina commento"
                      className="text-muted-foreground hover:text-red-600 p-1"
                    >
                      {deletingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>
              <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{c.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
