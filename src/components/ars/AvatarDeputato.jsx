import { useEffect, useState } from 'react';
import { iniziali, fotoDeputato } from '@/lib/ars';

// Foto del deputato (caricata dalla redazione nel pannello Admin → ARS);
// se manca o non si apre, le iniziali.
export default function AvatarDeputato({ d, grande = false }) {
  const [errore, setErrore] = useState(false);
  const foto = fotoDeputato(d?.foto_url);
  useEffect(() => { setErrore(false); }, [foto]);
  const cls = `dep-avatar${grande ? ' grande' : ''}`;
  if (foto && !errore) {
    return <img src={foto} alt={grande ? `Foto di ${d.nome}` : ''} className={`${cls} foto`} loading={grande ? 'eager' : 'lazy'} decoding="async" onError={() => setErrore(true)} />;
  }
  return <span className={cls} aria-hidden="true">{iniziali(d?.nome)}</span>;
}
