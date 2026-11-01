import { useEffect, useState } from 'react';
import { iniziali } from '@/lib/ars';

// Foto del deputato (caricata dalla redazione nel pannello Admin → ARS);
// se manca o non si apre, le iniziali.
export default function AvatarDeputato({ d, grande = false }) {
  const [errore, setErrore] = useState(false);
  useEffect(() => { setErrore(false); }, [d?.foto_url]);
  const cls = `dep-avatar${grande ? ' grande' : ''}`;
  if (d?.foto_url && !errore) {
    return <img src={d.foto_url} alt={grande ? `Foto di ${d.nome}` : ''} className={`${cls} foto`} loading={grande ? 'eager' : 'lazy'} decoding="async" onError={() => setErrore(true)} />;
  }
  return <span className={cls} aria-hidden="true">{iniziali(d?.nome)}</span>;
}
