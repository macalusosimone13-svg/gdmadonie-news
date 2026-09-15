import { useEffect, useState } from 'react';
import { sb44 } from '@/api/supabaseEntities';
import { Instagram, Facebook, Mail, Users, Send, Twitter, Youtube, Globe, Link as LinkIcon } from 'lucide-react';
import { loadSiteContent, getContent } from '@/lib/siteContent';
import { useSEO } from '@/lib/useSEO';

const SOCIAL_ICONS = { instagram: Instagram, facebook: Facebook, telegram: Send, twitter: Twitter, youtube: Youtube, website: Globe, email: Mail, custom: LinkIcon };

export default function ChiSiamo() {
  const [content, setContent] = useState(null);
  const [links, setLinks] = useState([]);

  useEffect(() => {loadSiteContent().then(setContent);}, []);
  useEffect(() => {
    sb44.entities.SocialLink.list('sort_order', 50).then((data) => setLinks((data || []).filter((l) => l.is_active))).catch(() => {});
  }, []);

  useSEO({
    title: 'Chi siamo — GD Madonie News',
    description: 'Giovani Democratici Madonie: organigramma, contatti e social.',
    type: 'website'
  });

  const organigramma = [
  { ruolo: 'Segretario', nome: getContent(content, 'org_segretario') },
  { ruolo: 'Vicesegretario', nome: getContent(content, 'org_vicesegretario') },
  { ruolo: 'Resp. Comunicazione', nome: getContent(content, 'org_resp_comunicazione') },
  { ruolo: 'Tesoriere', nome: getContent(content, 'org_tesoriere') }];

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <h1 className="tracking-tight text-[hsl(var(--primary))] font-serif font-normal text-3xl">Chi siamo</h1>
      <div className="bg-card border border-border p-5 shadow-sm rounded-2xl">
        <div className="flex items-center gap-2 mb-2 text-[#fd7125] rounded-xl">
          <Users className="w-5 h-5 text-[hsl(var(--primary))]" />
          <h2 className="text-foreground font-serif font-normal">Giovani Democratici Madonie</h2>
        </div>
        <p className="text-muted-foreground leading-relaxed whitespace-pre-line text-base font-serif font-normal">
          {getContent(content, 'gd_description')}
        </p>
      </div>
      <div className="bg-card border border-border p-5 shadow-sm rounded-2xl">
        <h3 className="text-foreground mb-3 font-serif font-normal">Organigramma</h3>
        <div className="space-y-1">
          {organigramma.map((o) =>
          <div key={o.ruolo} className="flex justify-between text-sm py-2 border-b border-border last:border-0 rounded-md">
              <span className="text-muted-foreground font-serif font-normal">{o.ruolo}</span>
              <span className="text-foreground font-serif font-normal">{o.nome}</span>
            </div>
          )}
        </div>
      </div>
      <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
        <h3 className="text-foreground mb-3 font-serif font-normal">Contatti e Social</h3>
        {links.length === 0 ?
        <p className="text-sm text-muted-foreground">Nessun contatto configurato.</p> :
        <div className="space-y-3">
            {links.map((l) => {
            const Icon = SOCIAL_ICONS[l.icon] || SOCIAL_ICONS[l.platform] || LinkIcon;
            const href = l.platform === 'email' ? l.url.startsWith('mailto:') ? l.url : `mailto:${l.url}` : l.url;
            return (
              <a key={l.id} href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-foreground hover:text-primary rounded-xl">
                  <Icon className="w-4 h-4 text-primary flex-shrink-0" /> {l.label}
                </a>);

          })}
          </div>
        }
      </div>
      <div className="rounded-2xl border-2 border-dashed border-primary/40 p-5 text-center space-y-2">
        <h3 className="text-foreground font-serif font-normal text-lg">Vuoi scrivere con noi?</h3>
        <p className="text-muted-foreground text-sm">Cerchiamo sempre nuove voci per raccontare il territorio delle Madonie. Se vuoi proporre un articolo, un'iniziativa o entrare a far parte del circolo, scrivici.</p>
        {(() => {
          const emailLink = links.find((l) => l.platform === 'email');
          const href = emailLink ? emailLink.url.startsWith('mailto:') ? emailLink.url : `mailto:${emailLink.url}` : null;
          return href ?
          <a href={href} className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-5 py-2.5 text-sm font-medium min-h-[44px] hover:opacity-90 transition-opacity">
              <Mail className="w-4 h-4" /> Scrivici
            </a> :

          <p className="text-xs text-muted-foreground">Usa uno dei contatti qui sopra.</p>;

        })()}
      </div>
    </div>);

}
