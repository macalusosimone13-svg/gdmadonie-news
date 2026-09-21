import AssistantChat from '@/components/AssistantChat';
import { Sparkles } from 'lucide-react';

export default function Assistant() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-[#2F5BD8]">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight leading-none">Assistente Eventi</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Scopri gli eventi e registrati con una chat</p>
        </div>
      </div>
      <AssistantChat title="Assistente Eventi" />
    </div>);

}
