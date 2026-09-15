import { useEffect, useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import ReactMarkdown from 'react-markdown';
import { Send, Loader2, Sparkles, Wrench, CheckCircle2, XCircle } from 'lucide-react';

export default function AgentChat({ agentName, title }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const convs = await base44.agents.listConversations({ agent_name: agentName });
        let conv = convs && convs.length ? convs[0] : null;
        if (!conv) {
          conv = await base44.agents.createConversation({ agent_name: agentName, metadata: { name: title || 'Assistente' } });
        }
        setConversation(conv);
        setMessages(conv.messages || []);
        setLoading(false);
      } catch (e) {
        setLoading(false);
      }
    })();
  }, [agentName]);

  useEffect(() => {
    if (!conversation?.id) return;
    const unsub = base44.agents.subscribeToConversation(conversation.id, (data) => {
      setMessages(data.messages || []);
      const last = (data.messages || [])[data.messages.length - 1];
      if (last?.role === 'assistant' && last.content) setSending(false);
    });
    return unsub;
  }, [conversation?.id]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || !conversation || sending) return;
    const content = input.trim();
    setInput('');
    setSending(true);
    setMessages((prev) => [...prev, { role: 'user', content }]);
    try {
      await base44.agents.addMessage(conversation, { role: 'user', content });
    } catch (e) {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-13rem)]">
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 -mr-1">
        {messages.length === 0 &&
        <div className="text-center py-10">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3 text-[#ff7124]">
              <Sparkles className="w-6 h-6" />
            </div>
            <p className="text-sm text-slate-500">Chiedimi quali eventi ci sono oregistrati a un evento del circolo.</p>
          </div>
        }
        {messages.map((m, i) => <MessageBubble key={i} message={m} />)}
        {sending &&
        <div className="flex justify-start">
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Sto scrivendo...
            </div>
          </div>
        }
        <div ref={scrollRef} />
      </div>
      <div className="mt-3 flex gap-2 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {if (e.key === 'Enter' && !e.shiftKey) {e.preventDefault();send();}}}
          rows={1}
          placeholder="Scrivi un messaggio..."
          className="flex-1 resize-none max-h-32 px-3 py-2.5 rounded-2xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
        
        <button
          onClick={send}
          disabled={!input.trim() || sending}
          className="flex-shrink-0 w-10 h-10 rounded-full text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 bg-[#ff7124]">
          
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>);

}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  return (
    <div className={isUser ? 'flex justify-end' : 'flex justify-start'}>
      <div className={`max-w-[85%] ${isUser ? '' : 'w-full'}`}>
        {message.content && (
        isUser ?
        <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2.5 text-sm">{message.content}</div> :

        <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-slate-800 prose prose-sm prose-p:my-0 prose-ul:my-1 prose-li:my-0 max-w-none">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>)

        }
        {message.tool_calls?.map((tc, idx) => <ToolCallDisplay key={idx} toolCall={tc} />)}
      </div>
    </div>);

}

function ToolCallDisplay({ toolCall }) {
  const status = toolCall.status;
  const failed = status === 'failed' || status === 'error';
  const running = status === 'pending' || status === 'running' || status === 'in_progress';
  let label = toolCall.name || 'Strumento';
  if (toolCall.display_projection?.label) label = toolCall.display_projection.label;
  return (
    <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400 bg-slate-50 rounded-lg px-2.5 py-1.5 w-fit">
      <Wrench className="w-3 h-3" />
      <span className="font-medium text-slate-500">{label}</span>
      {running && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
      {!running && !failed && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
      {failed && <XCircle className="w-3 h-3 text-red-500" />}
    </div>);

}
