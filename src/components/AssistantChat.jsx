import { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient'; // client Supabase già esistente nel progetto

const FUNCTION_URL = 'https://fxfckcpdxuyrhuinkyxq.supabase.co/functions/v1/assistant-chat';

export default function AssistantChat({ title }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const [greeting, setGreeting] = useState(null); // messaggio di benvenuto (solo locale)
  const [greeting_typing, setGreetingTyping] = useState(true);

  // Benvenuto appena si apre l'assistente: personalizzato col nome se si e' entrati.
  useEffect(() => {
    let alive = true;
    (async () => {
      let first = '';
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const full = session?.user?.user_metadata?.full_name || '';
        if (full && !full.includes('@')) first = full.split(' ')[0];
      } catch {}
      const h = new Date().getHours();
      const saluto = h < 6 ? 'Buonanotte' : h < 13 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera';
      const text = `${saluto}${first ? ', ' + first : ''}! 👋 Sono l'assistente dei **Giovani Democratici delle Madonie**.\n\nPosso dirti quali eventi del circolo sono in programma e aiutarti a registrarti. Da dove vuoi partire?`;
      setTimeout(() => { if (alive) { setGreeting(text); setGreetingTyping(false); } }, 900);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages]);

  const send = async (preset) => {
    const content = (typeof preset === 'string' ? preset : input).trim();
    if (!content || sending) return;
    setInput('');
    const nextMessages = [...messages, { role: 'user', content }];
    // il benvenuto e' solo grafico: non si manda al servizio
    setMessages(nextMessages);
    setSending(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setMessages((prev) => [...prev, { role: 'assistant', content: 'Devi accedere per usare l\'assistente eventi.' }]);
        setSending(false);
        return;
      }

      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const data = await res.json();
      if (data.error) {
        setMessages((prev) => [...prev, { role: 'assistant', content: `Errore: ${data.error}` }]);
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.content }]);
      }
    } catch (e) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Errore di connessione, riprova.' }]);
    }
    setSending(false);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto overscroll-contain space-y-4 pr-1 -mr-1">
        <div className="flex justify-start">
          <div className="max-w-[92%] w-full">
            <div className="flex items-center gap-2 mb-1.5 text-[11px] font-extrabold tracking-wider uppercase text-[#2F5BD8]"><Sparkles className="w-3.5 h-3.5" /> Assistente GD Madonie</div>
            {greeting_typing ?
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#2F5BD8]/60 animate-bounce" /><span className="w-2 h-2 rounded-full bg-[#2F5BD8]/60 animate-bounce" style={{ animationDelay: '.15s' }} /><span className="w-2 h-2 rounded-full bg-[#2F5BD8]/60 animate-bounce" style={{ animationDelay: '.3s' }} />
              </div> :
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-slate-800 prose prose-sm prose-p:my-1 max-w-none" style={{ animation: 'mn-rise .5s ease-out both' }}>
                <ReactMarkdown>{greeting}</ReactMarkdown>
              </div>}
            {!greeting_typing && messages.length === 0 &&
            <div className="flex flex-wrap gap-2 mt-3" style={{ animation: 'mn-rise .6s .15s ease-out both' }}>
                {['Quali eventi ci sono in arrivo?', 'Come mi registro a un evento?', 'Chi siete e cosa fate?'].map((q) =>
              <button key={q} onClick={() => send(q)} className="px-4 py-2 rounded-full border border-[#2F5BD8]/40 text-[#2F5BD8] text-[13px] font-bold bg-white hover:bg-[#2F5BD8] hover:text-white transition-colors">{q}</button>
              )}
              </div>}
          </div>
        </div>
        {messages.map((m, i) => <MessageBubble key={i} message={m} />)}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Sto scrivendo...
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>
      <div className="mt-3 flex gap-2 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={1}
          placeholder="Scrivi un messaggio..."
          className="flex-1 resize-none max-h-32 px-3 py-2.5 rounded-2xl border border-slate-200 bg-white text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
        <button
          onClick={() => send()}
          disabled={!input.trim() || sending}
          className="flex-shrink-0 w-10 h-10 rounded-full text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 bg-[#2F5BD8]"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function ChatLink({ href, children }) {
  const isExternal = /^https?:\/\//i.test(href || '');
  return (
    <a
      href={href}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      className="inline-flex items-center gap-1 mt-1 mb-0.5 px-3 py-1.5 rounded-full bg-[#2F5BD8]/10 text-[#2F5BD8] text-xs font-semibold no-underline hover:bg-[#2F5BD8]/20 transition-colors"
    >
      {children}
    </a>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  return (
    <div className={isUser ? 'flex justify-end' : 'flex justify-start'}>
      <div className={`max-w-[85%] ${isUser ? '' : 'w-full'}`}>
        {isUser ? (
          <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2.5 text-sm">{message.content}</div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-slate-800 prose prose-sm prose-p:my-0 prose-ul:my-1 prose-li:my-0 max-w-none">
            <ReactMarkdown components={{ a: ChatLink }}>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
