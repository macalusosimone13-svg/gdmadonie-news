import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { normalizeArticle } from '@/lib/articleText';

// Corpo di un articolo GD: il testo salvato nel database viene impaginato con
// titoletti, grassetti, elenchi, tabelle e riquadri in evidenza. I post
// vecchi, scritti come testo semplice, restano identici (gli "a capo" singoli
// sono rispettati grazie a remark-breaks). L'aspetto è in redesign.css, sotto
// ".ad-content".
const COMPONENTS = {
  // le tabelle larghe scorrono in orizzontale dentro il loro riquadro, senza allargare la pagina sul telefono
  table: ({ node: _n, ...props }) => <div className="ad-table"><table {...props} /></div>,
  a: ({ node: _n, href = '', children, ...props }) => {
    const esterno = /^https?:\/\//i.test(href);
    return <a href={href} {...(esterno ? { target: '_blank', rel: 'noopener noreferrer' } : {})} {...props}>{children}</a>;
  },
  // nel testo il titolo più grande è il titoletto di sezione: l'h1 è già il titolo dell'articolo
  h1: ({ node: _n, ...props }) => <h2 {...props} />,
};

export default function ArticleBody({ text }) {
  if (!text) return null;
  return (
    <div className="ad-content">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={COMPONENTS}>
        {normalizeArticle(text)}
      </ReactMarkdown>
    </div>);
}
