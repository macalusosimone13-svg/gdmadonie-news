// Sezione ARS (/ars/...): pagine gia' compilate dal server per Google e per le
// anteprime dei link (WhatsApp, Facebook, Telegram). Stessa logica di /paesi:
// si prende la index.html dell'app e ci si scrivono dentro titolo,
// descrizione, canonical, dati strutturati e il testo principale; poi React
// sostituisce il contenuto con la pagina interattiva.
// Gli indirizzi degli atti seguono la stessa regola di src/lib/ars.js.

import { esc, isHtml, nonTrovata, riscrivi, sb, taglia } from './seo';

const SITE = 'https://www.gdmadonie-news.com';
const OG = `${SITE}/og-home.jpg`;
const TIPI: Record<string, string> = { I: 'Interrogazione', P: 'Interpellanza', M: 'Mozione', D: 'Disegno di legge' };
const SLUG_TIPO: Record<string, string> = { I: 'interrogazione', P: 'interpellanza', M: 'mozione', D: 'ddl' };
const TIPO_SLUG: Record<string, string> = Object.fromEntries(Object.entries(SLUG_TIPO).map(([k, v]) => [v, k]));
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

const linkAtto = (k: string) => `/ars/atto/${SLUG_TIPO[k?.[0]] || 'atto'}-${String(k || '').slice(1)}`;
const linkLegge = (id: string) => `/ars/legge/${String(id || '').toLowerCase()}`;
const data = (d: string | null) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || '');
  return m ? `${+m[3]} ${MESI[+m[2] - 1]} ${m[1]}` : '';
};
const titoloLegge = (l: any) => l?.titolo_breve || l?.titolo || `Disegno di legge n. ${l?.ddl}`;
const commissione = (c: string) => (/^commission/i.test(String(c || '').trim()) ? c : `Commissione ${c}`);
const enc = encodeURIComponent;
const MADONIE = ['Madonie', 'Alimena', 'Aliminusa', 'Blufi', 'Bompietro', 'Caccamo', 'Caltavuturo', 'Castelbuono', 'Castellana Sicula', 'Cefalù', 'Collesano', 'Gangi', 'Geraci Siculo', 'Gratteri', 'Isnello', 'Montemaggiore Belsito', 'Petralia Soprana', 'Petralia Sottana', 'Polizzi Generosa', 'Pollina', 'San Mauro Castelverde', 'Scillato', 'Sclafani Bagni'];

const NAV = `<p><a href="/ars">ARS</a> · <a href="/ars/leggi">Leggi</a> · <a href="/ars/domande">Domande al Governo</a> · <a href="/ars/aula">Aula e commissioni</a> · <a href="/ars/deputati">Deputati</a></p>`;
const NOTA = `<p><small>Dati presi dai documenti ufficiali pubblicati dall'Assemblea Regionale Siciliana (ars.sicilia.it), aggiornati in automatico. GD Madonie News non è un sito dell'ARS.</small></p>`;
const testa = (k: string) => `<span class="k">${esc(k)}</span>`;

const rigaAtto = (a: any) => `<li><a href="${linkAtto(a.k)}">${esc(TIPI[a.tipo] || 'Atto')} n. ${a.n}</a> — ${esc(taglia(a.titolo, 180))}${a.data ? ` <small>(${esc(data(a.data))})</small>` : ''}</li>`;
const rigaLegge = (l: any) => `<li><a href="${linkLegge(l.id)}">${esc(titoloLegge(l))}</a> — ${l.approvata ? 'approvata' : 'respinta'} il ${esc(data(l.data))}${l.favorevoli != null ? ` (${l.favorevoli} sì, ${l.contrari ?? 0} no)` : ''}</li>`;

const BREAD = (voci: [string, string][]) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: voci.map(([nome, url], i) => ({ '@type': 'ListItem', position: i + 1, name: nome, item: SITE + url })),
});

// ---------- /ars ----------
async function panoramica(res: Response) {
  const [leggi, atti, madonie] = await Promise.all([
    sb('ars_leggi?select=id,ddl,titolo,titolo_breve,data,approvata,favorevoli,contrari&unita_a=is.null&order=data.desc&limit=10'),
    sb('ars_atti?select=k,tipo,n,titolo,data&order=data.desc.nullslast,n.desc&limit=15'),
    sb(`ars_atti?select=k,tipo,n,titolo,data&luoghi=ov.${enc('{' + MADONIE.map((m) => `"${m}"`).join(',') + '}')}&order=data.desc.nullslast&limit=10`),
  ]);
  if (leggi === null) return res;
  const description = "Cosa fa l'Assemblea Regionale Siciliana, spiegato semplice: leggi approvate, domande al Governo, sedute, commissioni e deputati. Con la ricerca che risponde alle tue domande.";
  const body = testa('Assemblea Regionale Siciliana') + `<h1>L'ARS, spiegata semplice</h1>` +
    `<p>${esc(description)}</p>` + NAV +
    `<h2>Le ultime leggi approvate</h2><ul>${(leggi || []).map(rigaLegge).join('')}</ul>` +
    ((madonie || []).length ? `<h2>Sulle Madonie</h2><ul>${madonie.map(rigaAtto).join('')}</ul>` : '') +
    `<h2>Gli ultimi atti presentati</h2><ul>${(atti || []).map(rigaAtto).join('')}</ul>` + NOTA;
  return riscrivi(res, {
    title: "ARS: leggi, interrogazioni e sedute dell'Assemblea Regionale Siciliana — GD Madonie News",
    description, url: `${SITE}/ars`, image: OG, body,
    jsonLd: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: "L'ARS, spiegata semplice", url: `${SITE}/ars`, description, inLanguage: 'it-IT', isPartOf: { '@type': 'WebSite', name: 'GD Madonie News', url: SITE } },
  });
}

// ---------- /ars/leggi ----------
async function elencoLeggi(res: Response) {
  const leggi = await sb('ars_leggi?select=id,ddl,titolo,titolo_breve,data,approvata,favorevoli,contrari&unita_a=is.null&order=data.desc');
  if (leggi === null) return res;
  const description = "Tutte le leggi votate dall'Assemblea Regionale Siciliana nella XVIII legislatura: titolo, data, voti favorevoli e contrari, percorso in commissione. Aggiornato in automatico.";
  const body = testa('ARS · Leggi') + `<h1>Le leggi approvate dall'ARS</h1><p>${esc(description)}</p>` + NAV +
    `<ul>${leggi.map(rigaLegge).join('')}</ul>` + NOTA;
  return riscrivi(res, {
    title: "Leggi approvate dall'ARS dal 2022 a oggi — GD Madonie News", description, url: `${SITE}/ars/leggi`, image: OG, body,
    jsonLd: BREAD([['ARS', '/ars'], ['Leggi', '/ars/leggi']]),
  });
}

// ---------- /ars/legge/<id> ----------
async function legge(res: Response, slug: string) {
  const id = slug.toUpperCase();
  const url = `${SITE}${linkLegge(id)}`;
  if (!/^[A-Z0-9-]{2,40}$/.test(id)) return nonTrovata(res, url, 'Legge');
  const righe = await sb(`ars_leggi?select=id,ddl,titolo,titolo_breve,data,approvata,favorevoli,contrari,astenuti,commissione,gurs,extra,unita_a&id=eq.${enc(id)}&limit=1`);
  if (righe === null) return res;
  const l = righe[0];
  if (!l) return nonTrovata(res, url, 'Legge');
  if (l.unita_a) return Response.redirect(`${SITE}${linkLegge(l.unita_a)}`, 301);
  const misure = (await sb(`ars_misure?select=articolo,titolo,sintesi,mln&legge_id=eq.${enc(id)}&nascosta=eq.false&order=ordine.asc&limit=60`)) || [];
  const breve: string[] = Array.isArray(l.extra?.breve) ? l.extra.breve : [];
  const tit = titoloLegge(l);
  const voto = l.favorevoli != null ? `${l.favorevoli} favorevoli, ${l.contrari ?? 0} contrari, ${l.astenuti ?? 0} astenuti` : '';
  const description = taglia(breve.join(' ') || `${l.approvata ? 'Approvata' : 'Respinta'} dall'ARS il ${data(l.data)}: ${l.titolo || tit}.${voto ? ' ' + voto + '.' : ''}`);
  const body = testa(`ARS · Disegno di legge n. ${l.ddl}`) + `<h1>${esc(tit)}</h1>` +
    `<div class="m">${l.approvata ? 'Approvata' : 'Respinta'} il ${esc(data(l.data))}${voto ? ' · ' + esc(voto) : ''}</div>` +
    (l.titolo && l.titolo !== tit ? `<p><em>${esc(l.titolo)}</em></p>` : '') +
    breve.map((t) => `<p>${esc(t)}</p>`).join('') +
    (l.commissione ? `<p>Esaminata da: ${esc(commissione(l.commissione))}</p>` : '') +
    (misure.length ? `<h2>Cosa prevede</h2><ul>${misure.map((m: any) => `<li><strong>${m.articolo ? 'Art. ' + esc(m.articolo) + ' — ' : ''}${esc(m.titolo)}</strong>${m.sintesi ? ': ' + esc(m.sintesi) : ''}${m.mln != null ? ` (${esc(String(m.mln).replace('.', ','))} milioni)` : ''}</li>`).join('')}</ul>` : '') +
    NAV + NOTA;
  return riscrivi(res, {
    title: `${tit} — Legge ARS — GD Madonie News`, description, url, image: OG, type: 'article', body,
    jsonLd: [BREAD([['ARS', '/ars'], ['Leggi', '/ars/leggi'], [tit, linkLegge(id)]]), {
      '@context': 'https://schema.org', '@type': 'Legislation', name: l.titolo || tit, alternateName: tit !== l.titolo ? tit : undefined,
      legislationIdentifier: `ddl ${l.ddl}`, legislationDate: l.data, legislationJurisdiction: 'Regione Siciliana',
      legislationPassedBy: { '@type': 'Organization', name: 'Assemblea Regionale Siciliana', url: 'https://www.ars.sicilia.it' },
      inLanguage: 'it-IT', url, description,
    }],
  });
}

// ---------- /ars/atto/<tipo>-<numero> ----------
async function atto(res: Response, slug: string) {
  const m = /^([a-z]+)-(\d{1,5})$/.exec(slug.toLowerCase());
  const k = m && TIPO_SLUG[m[1]] ? TIPO_SLUG[m[1]] + m[2] : null;
  const url = `${SITE}/ars/atto/${enc(slug.toLowerCase())}`;
  if (!k) return nonTrovata(res, url, 'Pagina');
  const righe = await sb(`ars_atti?select=k,tipo,n,titolo,data,firmatari,destinatari,luoghi,url_doc,sintesi,tema,ha_risposta,orale,risposta->d,risposta->u&k=eq.${k}&limit=1`);
  if (righe === null) return res;
  const a = righe[0];
  if (!a) return nonTrovata(res, url, 'Pagina');
  const tipo = TIPI[a.tipo] || 'Atto';
  const s = a.sintesi || {};
  const chiede: string[] = Array.isArray(s.chiede) ? s.chiede : [];
  const firm: string[] = a.firmatari || [];
  const stato = a.ha_risposta ? 'Il Governo ha risposto' : a.orale?.stato === 'trasformata' ? 'Trasformata in richiesta di risposta scritta' : a.orale?.stato === 'rinviata' ? 'Rinviata' : (a.tipo === 'I' || a.tipo === 'P') ? 'In attesa di risposta' : '';
  const description = taglia(s.breve || `${tipo} n. ${a.n}${firm.length ? ' di ' + firm.slice(0, 3).join(', ') : ''}: ${a.titolo}`);
  const body = testa(`ARS · ${tipo} n. ${a.n}`) + `<h1>${esc(a.titolo)}</h1>` +
    `<div class="m">${esc(data(a.data))}${a.tema ? ' · ' + esc(a.tema) : ''}${stato ? ' · ' + esc(stato) : ''}</div>` +
    (s.breve ? `<p>${esc(s.breve)}</p>` : '') +
    (chiede.length ? `<h2>Cosa chiede</h2><ul>${chiede.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : '') +
    (s.risposta ? `<h2>La risposta</h2><p>${esc(typeof s.risposta === 'string' ? s.risposta : (s.risposta.breve || ''))}</p>` : '') +
    (firm.length ? `<p>Presentata da: ${esc(firm.join(', '))}</p>` : '') +
    ((a.destinatari || []).length ? `<p>Rivolta a: ${esc(a.destinatari.join(', '))}</p>` : '') +
    ((a.luoghi || []).length ? `<p>Luoghi citati: ${esc(a.luoghi.join(', '))}</p>` : '') +
    (a.url_doc ? `<p><a href="${esc(a.url_doc)}" rel="noopener nofollow">Documento ufficiale dell'ARS</a></p>` : '') +
    NAV + NOTA;
  return riscrivi(res, {
    title: `${taglia(a.titolo, 90)} — ${tipo} n. ${a.n} all'ARS — GD Madonie News`, description, url, image: OG, type: 'article', body,
    jsonLd: [BREAD([['ARS', '/ars'], ['Domande al Governo', '/ars/domande'], [`${tipo} n. ${a.n}`, linkAtto(a.k)]]), {
      '@context': 'https://schema.org', '@type': 'Legislation', name: a.titolo, legislationIdentifier: `${tipo} n. ${a.n}`,
      legislationType: tipo, legislationDate: a.data || undefined, legislationJurisdiction: 'Regione Siciliana',
      author: firm.map((n) => ({ '@type': 'Person', name: n })), inLanguage: 'it-IT', url, description,
    }],
  });
}

// ---------- /ars/domande ----------
async function domande(res: Response) {
  const atti = await sb('ars_atti?select=k,tipo,n,titolo,data&tipo=in.(I,P,M)&order=data.desc.nullslast,n.desc&limit=60');
  if (atti === null) return res;
  const description = "Interrogazioni, interpellanze e mozioni presentate all'Assemblea Regionale Siciliana: cosa chiedono i deputati al Governo regionale e se hanno avuto risposta. Cerca per paese, tema o deputato.";
  const body = testa('ARS · Domande al Governo') + `<h1>Le domande al Governo regionale</h1><p>${esc(description)}</p>` + NAV +
    `<h2>Le più recenti</h2><ul>${atti.map(rigaAtto).join('')}</ul>` + NOTA;
  return riscrivi(res, { title: "Interrogazioni e mozioni all'ARS — GD Madonie News", description, url: `${SITE}/ars/domande`, image: OG, body, jsonLd: BREAD([['ARS', '/ars'], ['Domande al Governo', '/ars/domande']]) });
}

// ---------- /ars/aula ----------
async function aula(res: Response) {
  const oggi = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
  const [sedute, conv] = await Promise.all([
    sb('ars_sedute?select=n,data,odg&tolta=eq.false&order=data.desc&limit=12'),
    sb(`ars_convocazioni?select=data,commissione,odg&tolta=eq.false&data=gte.${oggi}&order=data.asc&limit=20`),
  ]);
  if (sedute === null) return res;
  const description = "Le sedute dell'Aula dell'Assemblea Regionale Siciliana e le riunioni delle commissioni: cosa si discute, cosa si è votato, con i resoconti ufficiali.";
  const body = testa('ARS · Aula e commissioni') + `<h1>Aula e commissioni</h1><p>${esc(description)}</p>` + NAV +
    ((conv || []).length ? `<h2>Prossime riunioni delle commissioni</h2><ul>${conv.map((c: any) => `<li>${esc(data(c.data))} — ${esc(commissione(c.commissione))}${c.odg ? ': ' + esc(taglia(c.odg, 200)) : ''}</li>`).join('')}</ul>` : '') +
    `<h2>Le ultime sedute dell'Aula</h2><ul>${sedute.map((s: any) => `<li>Seduta n. ${s.n} del ${esc(data(s.data))}${(s.odg || []).length ? ': ' + esc(taglia(s.odg.join(' · '), 220)) : ''}</li>`).join('')}</ul>` + NOTA;
  return riscrivi(res, { title: "Sedute dell'ARS e commissioni — GD Madonie News", description, url: `${SITE}/ars/aula`, image: OG, body, jsonLd: BREAD([['ARS', '/ars'], ['Aula e commissioni', '/ars/aula']]) });
}

// ---------- /ars/deputati ----------
async function deputati(res: Response) {
  const dep = await sb('ars_deputati?select=nome,gruppo,collegio,palermo&in_carica=eq.true&order=nome.asc');
  if (dep === null) return res;
  const pa = dep.filter((d: any) => d.palermo);
  const description = `I ${dep.length} deputati in carica all'Assemblea Regionale Siciliana, con gruppo e collegio. ${pa.length} sono eletti nel collegio di Palermo, quello delle Madonie.`;
  const riga = (d: any) => `<li>${esc(d.nome)}${d.gruppo ? ' — ' + esc(d.gruppo) : ''}${d.collegio ? ' (' + esc(d.collegio) + ')' : ''}</li>`;
  const body = testa('ARS · Deputati') + `<h1>Chi ci rappresenta all'ARS</h1><p>${esc(description)}</p>` + NAV +
    (pa.length ? `<h2>Eletti nel collegio di Palermo</h2><ul>${pa.map(riga).join('')}</ul>` : '') +
    `<h2>Tutti i deputati</h2><ul>${dep.map(riga).join('')}</ul>` + NOTA;
  return riscrivi(res, { title: "Deputati dell'ARS: chi ci rappresenta — GD Madonie News", description, url: `${SITE}/ars/deputati`, image: OG, body, jsonLd: BREAD([['ARS', '/ars'], ['Deputati', '/ars/deputati']]) });
}

export async function paginaArs(context: any): Promise<Response> {
  const res: Response = await context.next();
  if (!isHtml(res)) return res;
  const { pathname } = new URL(context.request.url);
  const parti = pathname.replace(/\/+$/, '').split('/').filter(Boolean).slice(1).map((p) => decodeURIComponent(p));
  try {
    if (parti.length === 0) return await panoramica(res);
    if (parti.length === 1) {
      if (parti[0] === 'leggi') return await elencoLeggi(res);
      if (parti[0] === 'domande') return await domande(res);
      if (parti[0] === 'aula') return await aula(res);
      if (parti[0] === 'deputati') return await deputati(res);
      if (parti[0] === 'avvisi') return riscrivi(res, { title: 'Avvisi ARS — GD Madonie News', description: "Ricevi un'email quando l'ARS si occupa di ciò che ti interessa.", url: `${SITE}/ars/avvisi`, noindex: true });
    }
    if (parti.length === 2 && parti[0] === 'legge') return await legge(res, parti[1]);
    if (parti.length === 2 && parti[0] === 'atto') return await atto(res, parti[1]);
  } catch {
    return res;
  }
  return nonTrovata(res, SITE + pathname, 'Pagina');
}
