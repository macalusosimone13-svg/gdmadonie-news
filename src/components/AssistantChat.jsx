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

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || sending) return;
    const content = input.trim();
    setInput('');
    const nextMessages = [...messages, { role: 'user', content }];
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
    <div className="flex flex-col h-[calc(100vh-13rem)]">
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 -mr-1">
        {messages.length === 0 && (
          <div className="text-center py-10">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3 text-[#ff7124]">
              <Sparkles className="w-6 h-6" />
            </div>
            <p className="text-sm text-slate-500">Chiedimi quali eventi ci sono o registrati a un evento del circolo.</p>
          </div>
        )}
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
          className="flex-1 resize-none max-h-32 px-3 py-2.5 rounded-2xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
        <button
          onClick={send}
          disabled={!input.trim() || sending}
          className="flex-shrink-0 w-10 h-10 rounded-full text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 bg-[#ff7124]"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
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
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
