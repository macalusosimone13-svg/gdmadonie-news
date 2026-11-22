// Disegna la copertina "solo titolo" di News GD (1080x1350), la stessa che il
// pannello Admin crea nel browser (src/lib/storyImage.js, drawTextOnlyCard con
// la palette NEWS_GD_BRAND di RedazionePanel.jsx): sfondo blu sfumato, marchio
// GD MADONIE / NEWS, pillola "NEWS GD", trattino, titolo in maiuscolo Rubik 900
// che si adatta alla lunghezza (ultima riga azzurra), riga e dominio in basso.
// Il testo diventa forme vettoriali (opentype.js) e l'SVG si converte in PNG
// con resvg: nessun font di sistema necessario.
import opentype from 'npm:opentype.js@1.3.4';
import { initWasm, Resvg } from 'npm:@resvg/resvg-wasm@2.6.2';

const W = 1080, H = 1350, LEFT = 64, MAX_W = W - LEFT * 2;
const CSS = 'https://fonts.googleapis.com/css2?family=Rubik:wght@800;900&family=Figtree:wght@600;700&display=swap';
const WASM = 'https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.2/index_bg.wasm';

type Font = opentype.Font;
let pronti: Promise<Record<string, Font>> | null = null;

async function caricaFont(): Promise<Record<string, Font>> {
  const css = await (await fetch(CSS)).text();
  const out: Record<string, Font> = {};
  for (const b of css.split('@font-face').slice(1)) {
    const fam = b.match(/font-family:\s*'([^']+)'/)?.[1];
    const w = b.match(/font-weight:\s*(\d+)/)?.[1];
    const url = b.match(/url\(([^)]+\.ttf)\)/)?.[1];
    // solo il sottoinsieme latino (l'ultimo blocco di ogni peso, quando ce ne sono piu')
    if (fam && w && url) out[`${fam} ${w}`] = opentype.parse(await (await fetch(url)).arrayBuffer());
  }
  for (const k of ['Rubik 900', 'Rubik 800', 'Figtree 600', 'Figtree 700']) if (!out[k]) throw new Error('Font mancante: ' + k);
  return out;
}

async function prepara() {
  if (!pronti) {
    pronti = (async () => {
      await initWasm(fetch(WASM));
      return await caricaFont();
    })().catch((e) => { pronti = null; throw e; });
  }
  return pronti;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// larghezza del testo con spaziatura tra le lettere (come ctx.letterSpacing)
function larghezza(f: Font, t: string, size: number, spazio = 0) {
  return f.getAdvanceWidth(t, size) + spazio * Math.max(0, [...t].length);
}
function tracciato(f: Font, t: string, x: number, y: number, size: number, colore: string, spazio = 0) {
  if (!spazio) return `<path fill="${colore}" d="${f.getPath(t, x, y, size).toPathData(2)}"/>`;
  let d = '', cx = x;
  for (const ch of t) { d += f.getPath(ch, cx, y, size).toPathData(2); cx += f.getAdvanceWidth(ch, size) + spazio; }
  return `<path fill="${colore}" d="${d}"/>`;
}

function aCapo(f: Font, testo: string, size: number) {
  const righe: string[] = [];
  let riga = '';
  for (const p of testo.split(/\s+/).filter(Boolean)) {
    const prova = riga ? `${riga} ${p}` : p;
    if (larghezza(f, prova, size) > MAX_W && riga) { righe.push(riga); riga = p; } else riga = prova;
  }
  if (riga) righe.push(riga);
  return righe;
}

// stessa regola di fitTitle(): da 112 a 54 px a passi di 2, interlinea 1.08
function adatta(f: Font, testo: string, maxH: number) {
  for (let n = 112; n >= 54; n -= 2) {
    const righe = aCapo(f, testo, n);
    const piuLarga = Math.max(...righe.map((r) => larghezza(f, r, n)));
    if (righe.length * n * 1.08 <= maxH && piuLarga <= MAX_W) return { size: n, lh: n * 1.08, righe };
  }
  const n = 54;
  let righe = aCapo(f, testo, n);
  const max = Math.max(1, Math.floor(maxH / (n * 1.08)));
  if (righe.length > max) {
    righe = righe.slice(0, max);
    let r = righe[max - 1] + '…';
    while (r.length > 1 && larghezza(f, r, n) > MAX_W) r = r.slice(0, -2) + '…';
    righe[max - 1] = r;
  }
  return { size: n, lh: n * 1.08, righe };
}

export async function copertinaSvg(titolo: string, categoria = 'News GD', dominio = 'gdmadonie-news.com') {
  const F = await prepara();
  const parti: string[] = [];
  // sfondo: gradiente da (0,0) a (W*0.3, H) come drawBase()
  parti.push(`<defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${W * 0.3}" y2="${H}"><stop offset="0" stop-color="#1B3A8C"/><stop offset="0.55" stop-color="#0F1B3A"/><stop offset="1" stop-color="#0A1226"/></linearGradient></defs>`);
  parti.push(`<rect width="${W}" height="${H}" fill="url(#g)"/>`);
  // marchio testuale (drawBrandBadge senza logo): logoX 64, logoY 90
  parti.push(tracciato(F['Rubik 900'], 'GD MADONIE', 64, 90 + 66, 68, '#ffffff'));
  parti.push(tracciato(F['Rubik 800'], 'NEWS', 68, 90 + 112, 28, '#7EA0FF', 10));
  // pillola della categoria
  let y = 330;
  const cat = categoria.toUpperCase();
  const fp = F['Figtree 700'];
  const pillW = larghezza(fp, cat, 26) + 44, pillH = 54;
  parti.push(`<rect x="${LEFT}" y="${y}" width="${pillW.toFixed(1)}" height="${pillH}" rx="27" fill="#2F5BD8"/>`);
  parti.push(tracciato(fp, cat, LEFT + 22, y + pillH / 2 + 2 + 9, 26, '#FFFFFF'));
  y += pillH + 44;
  // trattino
  parti.push(`<rect x="${LEFT}" y="${y}" width="72" height="8" fill="#2F5BD8"/>`);
  y += 44;
  // titolo
  const dominioY = H - 90;
  const maxH = dominioY - 110 - y;
  const ft = F['Rubik 900'];
  const t = adatta(ft, (titolo || '').toUpperCase(), maxH);
  t.righe.forEach((r, i) => {
    const colore = t.righe.length > 1 && i === t.righe.length - 1 ? '#8FB0FF' : '#ffffff';
    parti.push(tracciato(ft, r, LEFT, y + t.size * 0.9 + i * t.lh, t.size, colore));
  });
  // riga e dominio
  const ly = dominioY - 48;
  parti.push(`<line x1="${LEFT}" y1="${ly}" x2="${W - LEFT}" y2="${ly}" stroke="#8FB0FF" stroke-opacity="0.28" stroke-width="2"/>`);
  parti.push(tracciato(F['Figtree 600'], dominio, LEFT, dominioY, 30, '#8FB0FF'));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><title>${esc(titolo)}</title>${parti.join('')}</svg>`;
}

export async function copertinaPng(titolo: string, categoria?: string) {
  const svg = await copertinaSvg(titolo, categoria);
  const r = new Resvg(svg, { fitTo: { mode: 'original' } });
  const png = r.render().asPng();
  r.free();
  return png;
}
