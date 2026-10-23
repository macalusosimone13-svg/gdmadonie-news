"""Lettura dei documenti dell'ARS (testo estratto dai PDF con pdftotext -layout).

Dalla cache costruisce:
  - atti: interrogazioni, interpellanze, mozioni e disegni di legge (allegati
    agli ordini del giorno e ai resoconti), con testo, firmatari, luoghi e
    risposte del Governo (scritte e in Aula);
  - leggi: le votazioni finali dei disegni di legge lette nei resoconti;
  - sedute: data, punti all'ordine del giorno e link ai documenti.
Le regole sono le stesse del prototipo v4 (22-23/10/2026).
"""
import difflib
import glob
import json
import os
import re
import unicodedata

MESI = {'gennaio': 1, 'febbraio': 2, 'marzo': 3, 'aprile': 4, 'maggio': 5, 'giugno': 6, 'luglio': 7,
        'agosto': 8, 'settembre': 9, 'ottobre': 10, 'novembre': 11, 'dicembre': 12}
TIPI = {'I': 'Interrogazione', 'D': 'Disegno di legge', 'M': 'Mozione', 'P': 'Interpellanza'}

COMUNI = ['Alimena', 'Aliminusa', 'Blufi', 'Bompietro', 'Caccamo', 'Caltavuturo', 'Castelbuono', 'Castellana Sicula',
          'Cefalù', 'Collesano', 'Gangi', 'Geraci Siculo', 'Gratteri', 'Isnello', 'Montemaggiore Belsito',
          'Petralia Soprana', 'Petralia Sottana', 'Polizzi Generosa', 'Pollina', 'San Mauro Castelverde', 'Scillato',
          'Sclafani Bagni']
# luoghi del territorio -> comune (None = Madonie in generale)
LUOGHI = {'Piano Battaglia': None, 'Piano Zucchi': 'Isnello', 'Gibilmanna': 'Cefalù', 'Calcarelli': 'Castellana Sicula',
          'Raffo': 'Petralia Soprana', 'Gangivecchio': 'Gangi', 'Finale di Pollina': 'Pollina',
          "Sant'Ambrogio di Cefal": 'Cefalù', 'Madonie': None, 'madonit': None, 'Imera': None,
          'Parco delle Madonie': None}
STRADE = [(r'\b(?:SS|S\.S\.|strada statale)\s*n?\.?\s*120\b', 'SS 120'),
          (r'\b(?:SS|S\.S\.|strada statale)\s*n?\.?\s*643\b', 'SS 643'),
          (r'\b(?:SS|S\.S\.|strada statale)\s*n?\.?\s*286\b', 'SS 286')]
GRUPPI_BREVI = {"Partito Democratico XVIII Legislatura": "PD", "Fratelli d'Italia XVIII Legislatura": "Fratelli d'Italia",
                "Forza Italia all'ARS": "Forza Italia", "Movimento 5 Stelle": "M5S",
                "Prima l'Italia - Lega Salvini Premier": "Lega",
                "Controcorrente - Ismaele La Vardera Presidente": "Controcorrente",
                "Sud chiama Nord per le autonomie": "Sud chiama Nord"}


def data_ok(y, m, d):
    """'YYYY-MM-DD' solo se la data esiste (i PDF letti male danno date come 33 gennaio)."""
    try:
        import datetime
        return datetime.date(int(y), int(m), int(d)).isoformat()
    except (ValueError, TypeError):
        return None


def nz(s):
    return unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode().lower()


def gruppo_breve(g):
    return GRUPPI_BREVI.get(g or '', g or '') or None


# citazioni di passaggio che non riguardano il paese
CITAZIONI = [r'cattedral\w* di cefalu e monreale', r'palermo arabo.normanna', r'cefalu.monreale']
CONTESTO = r'(?:comune|comuni|territorio|territori|cittadina|citta|paese|centro|frazione|contrada|localita|ospedale|ospedali|presidio|plesso|scuola|istituto|sindaco|sindaca|abitanti|comunita|zona|area|porto|stazione|svincolo|strada|via|diga|invaso|distretto|asp|fondazione|consiglio|giunta)'


def luoghi(text, titolo=''):
    """Paesi e luoghi delle Madonie nominati in un atto.
    Un comune conta se e' nel titolo, oppure se il testo ne parla davvero:
    almeno due volte, o con un contesto ("Comune di X", "territorio di X", "X (PA)").
    Cosi' una citazione di passaggio (es. "le Cattedrali di Cefalu' e Monreale") non basta."""
    t = nz(text)
    for c in CITAZIONI:
        t = re.sub(c, ' ', t)
    tt = nz(titolo or '')
    out = []

    def conta(w):
        return len(re.findall(r'\b' + re.escape(nz(w)) + ('' if w == 'madonit' else r'\b'), t))

    def forte(w):
        x = re.escape(nz(w))
        if tt and re.search(r'\b' + x + r'\b', tt):
            return True
        if conta(w) >= 2:
            return True
        return bool(re.search(r'\b' + CONTESTO + r'(?:\s+\w+){0,2}\s+(?:di|del|della|dello|dei|delle|a|in)\s+(?:\w+\s+){0,2}' + x + r'\b', t) or re.search(r'\b' + x + r'\s*\(\s*pa\s*\)', t)
                    or re.search(r'\bp\.\s?o\.[^.;]{0,50}\b' + x + r'\b', t))
    for c in COMUNI:
        if conta(c) and forte(c):
            out.append(c)
    for l, c in LUOGHI.items():
        if not conta(l):
            continue
        generico = l in ('Madonie', 'madonit', 'Parco delle Madonie', 'Piano Battaglia')
        if not generico and not forte(l):
            continue
        if c and c not in out:
            out.append(c)
        if not c and 'Madonie' not in out:
            out.append('Madonie')
        if l not in ('Madonie', 'madonit') and l not in out:
            out.append(l)
    for rx, lab in STRADE:
        if re.search(rx, text, re.I):
            out.append(lab)
            if 'Madonie' not in out:
                out.append('Madonie')
    if 'Imera' in out and not any(c in out for c in COMUNI):
        out.remove('Imera')  # Imera da solo e' ambiguo (il fiume attraversa mezza Sicilia)
    return out


def pulisci(t):
    t = t.replace('\f', ' ')
    t = re.sub(r'-\n\s*', '', t)  # parole spezzate a fine riga
    t = re.sub(r'\n\s*-\s?\d{1,3}\s?-\s*\n', '\n', t)
    t = re.sub(r'XVIII (?:Legislatura|LEGISLATURA)(?: ARS)?', '', t)
    return re.sub(r'\s+', ' ', t).strip()


def pulisci_breve(t):
    return re.sub(r'\s+', ' ', re.sub(r'-\n\s*', '', t.replace('\f', ' '))).strip()


class Nomi:
    """Riconduce i firmatari letti nei PDF all'elenco ufficiale dei deputati."""

    def __init__(self, deputati):
        self.ufficiali = [d['nome'] for d in deputati]
        self.offn = {nz(n): n for n in self.ufficiali}
        self.gruppo = {d['nome']: d.get('gruppo') for d in deputati}
        self.cognomi = {}
        for n in self.ufficiali:
            p = n.split()
            sur = ' '.join(p[:2]) if p[0] in ('De', 'La', 'Lo', 'Di') and len(p) > 2 else p[0]
            self.cognomi.setdefault(nz(sur), []).append(n)

    def correggi(self, raw):
        r = re.sub(r"[^A-Za-zÀ-ÿ' ]", ' ', raw)
        r = re.sub(r'\s+', ' ', r).strip()
        if not r or len(r) < 4:
            return None
        k = nz(r)
        if k in self.offn:
            return self.offn[k]
        m = difflib.get_close_matches(k, list(self.offn), n=1, cutoff=0.72)
        return self.offn[m[0]] if m else None

    def firme_in_coda(self, body):
        """Firme in maiuscolo dopo la data di presentazione: '(12 ottobre 2026) ROSSI - BIANCHI'."""
        m = None
        for m in re.finditer(r'\(\s*(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})\s*\)\s*\n((?:[ \t]*[A-ZÀ-Ü][A-ZÀ-Ü\'’. ]+(?:\s*-\s*[A-ZÀ-Ü][A-ZÀ-Ü\'’. ]*)*\s*-?[ \t]*\n){1,5})', body):
            pass
        if not m:
            return [], None
        raw = re.sub(r'\s+', ' ', m.group(4))
        out = []
        for tok in [x.strip(' .') for x in raw.split(' - ') if x.strip(' .-')]:
            tok = tok.strip(' -')
            mm = re.match(r"^(.*?)(?:\s+([A-Z])\.)?$", tok)
            sur = nz(mm.group(1).strip())
            ini = mm.group(2)
            c = self.cognomi.get(sur, [])
            if ini:
                c = [x for x in c if nz(x.split()[-1])[0] == ini.lower() or any(nz(w)[0] == ini.lower() for w in x.split()[1:])] or c
            if c and c[0] not in out:
                out.append(c[0])
        return out, data_ok(m.group(3), MESI[m.group(2)], m.group(1))


def leggi_links(cache):
    odg, res = {}, {}
    p = os.path.join(cache, 'links.txt')
    if os.path.exists(p):
        for l in open(p, encoding='utf-8'):
            pp = l.strip().split('|')
            if len(pp) == 3:
                if pp[1]:
                    odg[pp[0]] = pp[1]
                if pp[2]:
                    res[pp[0]] = pp[2]
    return odg, res


def leggi_sedute(cache):
    """sedute.txt: 'YYYYMMDD seduta-numero-N-del-DDMMYYYY' (una riga per giorno di seduta)."""
    sd, giorni = {}, {}
    p = os.path.join(cache, 'sedute.txt')
    if os.path.exists(p):
        for l in open(p, encoding='utf-8'):
            parts = l.split()
            if len(parts) != 2:
                continue
            day, slug = parts
            n = re.search(r'numero-(\d+)', slug).group(1)
            dd = re.search(r'(\d{8})$', slug).group(1)
            sd[n] = f"{dd[4:]}-{dd[2:4]}-{dd[:2]}"
            giorni.setdefault(n, set()).add(f"{day[:4]}-{day[4:6]}-{day[6:]}")
    return sd, giorni


def url_allegati(cache):
    """Indirizzo dell'Allegato A di ogni resoconto (da stato.json, scritto da scarica.py)."""
    out = {}
    try:
        st = json.load(open(os.path.join(cache, 'stato.json'), encoding='utf-8'))
    except Exception:
        return out
    for n, info in (st.get('res') or {}).items():
        for a in info.get('allegati', []):
            if re.match(r'(?i)allegato a\b', a.get('l', '')):
                out[n] = a['u']
    return out


def testi_ddl(cache):
    """Testi dei disegni di legge allegati ai resoconti: {(seduta, numero): testo}."""
    out = {}
    for f in glob.glob(os.path.join(cache, 'ddl', '*.txt')):
        base = os.path.basename(f)[:-4]
        sn, _, etich = base.partition('_')
        nums = re.findall(r'\d{2,5}', etich)
        if not nums:
            continue
        t = pulisci(open(f, encoding='utf-8', errors='ignore').read())
        out[(int(sn), nums[0])] = t
    return out


def data_da_url_odg(u):
    m = re.search(r'ODG_18_(\d{4})_(\d\d)_(\d\d)_', u or '')
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else None


def numero_file(p):
    return int(os.path.basename(p)[:-4])


def atti_da_documenti(cache, nomi):
    """Ordini del giorno ('o') e resoconti ('r') → atti + testi + risposte scritte."""
    urls, resurl = leggi_links(cache)
    sdate, _ = leggi_sedute(cache)
    items, texts = {}, {}
    allurl = url_allegati(cache)
    files = [(f, 'o') for f in sorted(glob.glob(os.path.join(cache, 'odg', '*.txt')), key=numero_file)] + \
            [(f, 'a') for f in sorted(glob.glob(os.path.join(cache, 'all', '*.txt')), key=numero_file)] + \
            [(f, 'r') for f in sorted(glob.glob(os.path.join(cache, 'res', '*.txt')), key=numero_file)]
    for f, SRC in files:
        sn = os.path.basename(f)[:-4]
        u = urls.get(sn) if SRC == 'o' else allurl.get(sn) if SRC == 'a' else resurl.get(sn)
        if not u:
            continue
        d = (data_da_url_odg(u) or sdate.get(sn)) if SRC == 'o' else sdate.get(sn)
        if not d:
            continue
        t = open(f, encoding='utf-8', errors='ignore').read()

        def page_at(pos):
            return t.count('\f', 0, pos) + 1
        # disegni di legge presentati
        if 'DISEGNI DI LEGGE PRESENTATI' in t:
            st = t.index('DISEGNI DI LEGGE PRESENTATI')
            seg = t[st:]
            stop = re.search(r'\n\s*(INTERROGAZIONI CON|INTERPELLANZE|MOZIONI|GOVERNO REGIONALE|COMUNICAZION|RISPOSTE SCRITTE)', seg)
            seg = seg[:stop.start()] if stop else seg[:20000]
            comm = None
            for blk in re.split(r'\n\s*\n', seg):
                h = re.match(r'^\s*([A-Z ,\'’]+)\(\s*([IVXl]+|Il)\s*\)\s*$', blk.strip())
                if h:
                    comm = h.group(1).strip().title()
                    continue
                m = re.search(r'(?s)^\s*-\s*(.+?)\(n\.\s*(\d{3,5})\)\.?\s*(.*)$', blk.strip())
                if m:
                    k = 'D' + m.group(2)
                    if k in items:
                        continue
                    ini = re.search(r'Di iniziativa ([a-z ]+)', m.group(3))
                    title = pulisci(m.group(1)).rstrip('. ')
                    items[k] = dict(k=k, tipo='D', n=int(m.group(2)), t=title, d=d,
                                    f=('Iniziativa ' + ini.group(1).strip()) if ini else '', a=comm or '', s=int(sn),
                                    c=luoghi(title, title), p=page_at(st + seg.find(blk[:40])), src=SRC)
        # interrogazioni, interpellanze, mozioni
        lines = t.split('\n')
        offs, acc = [], 0
        for L in lines:
            offs.append(acc)
            acc += len(L) + 1
        sec, idx = None, []
        for i, L in enumerate(lines):
            s_ = L.strip()
            if s_.startswith('INTERROGAZIONI CON RICHIESTA') or s_.startswith('Annunzio di interrogazioni'):
                sec = 'I'
            elif s_.startswith('INTERPELLANZE') or s_.startswith('Annunzio di interpellanz'):
                sec = 'P'
            elif s_ == 'MOZIONI' or s_.startswith('Annunzio di mozion'):
                sec = 'M'
            elif s_.startswith('RISPOSTE SCRITTE') or s_.startswith('Annunzio di risposte') or s_.startswith('Annunzio di disegni') or s_.startswith('Comunicazione'):
                sec = None
            m = re.match(r'^\s{0,6}N\. ?(\d{1,5}) - (.*)', L)
            if m and sec:
                # sotto "MOZIONI"/"INTERPELLANZE" i numeri da 1000 in su sono interrogazioni
                idx.append((i, 'I' if sec != 'I' and int(m.group(1)) >= 1000 else sec, m.group(1)))
        for j, (i, tp, num) in enumerate(idx):
            k = tp + num
            endi = idx[j + 1][0] if j + 1 < len(idx) else min(len(lines), i + 500)
            body = '\n'.join(lines[i:endi])
            if k in items:
                it = items[k]
                for c in luoghi(body, it['t']):
                    if c not in it['c']:
                        it['c'].append(c)
                if not it['f']:
                    nm2, dp = nomi.firme_in_coda(body)
                    if nm2:
                        it['f'] = nm2
                    if dp and not it.get('dp'):
                        it['dp'] = dp
                if len(pulisci(body)) > len(texts.get(k, {}).get('txt', '')):
                    texts.setdefault(k, {})['txt'] = pulisci(body)[:9000]
                    it['p'] = page_at(offs[i])
                continue
            title = re.sub(r'^\s{0,6}N\. ?\d+ - ', '', lines[i]).strip()
            q = i + 1
            while q < endi and lines[q].strip() and not re.match(r'^\s*- ', lines[q]):
                title += ' ' + lines[q].strip()
                q += 1
            dest = []
            while q < endi and re.match(r'^\s*- ', lines[q]):
                dest.append(lines[q].strip()[2:])
                q += 1
            firm = ''
            while q < endi and lines[q].strip() and 'XVIII' not in lines[q] and 'INTERROG' not in lines[q] and 'MOZIONE' not in lines[q] and 'INTERPELL' not in lines[q]:
                firm += ' ' + lines[q].strip()
                q += 1
            names = []
            for raw in firm.split(';'):
                nm = nomi.correggi(raw)
                if nm and nm not in names:
                    names.append(nm)
            nm2, dp = nomi.firme_in_coda(body)
            if not names:
                names = nm2
            items[k] = dict(k=k, tipo=tp, n=int(num), t=pulisci(title).rstrip('.'), d=d, dp=dp, f=names,
                            a=[x for x in dest if not re.match(r'^-?\d', x)], s=int(sn), c=luoghi(body, title),
                            p=page_at(offs[i]), src=SRC)
            texts[k] = {'txt': pulisci(body)[:9000]}
        # risposte scritte del Governo
        for m in re.finditer(r'(?:Oggetto:\s*Interrogazione(?:\s+parlamentare)?\s*(?:n|si|N|nr)\s*\.?\s*(\d{3,5}))|(?:Con riferimento all.interrogazione\s*n\.?\s*(\d{3,5}))', t, re.I):
            num = m.group(1) or m.group(2)
            k = 'I' + num
            nxt = re.search(r'Oggetto:\s*Interrogazione', t[m.end():])
            endp = m.end() + (nxt.start() if nxt else 6000)
            ans = pulisci(t[m.start():min(endp, m.start() + 7000)])
            r = texts.setdefault(k, {})
            if 'risp' not in r or r['risp']['d'] > d:
                r['risp'] = {'d': d, 's': int(sn), 'p': page_at(m.start()), 'txt': ans[:5000], 'src': SRC, 'u': u}
            if k not in items:
                pre = t[max(0, m.start() - 2500):m.start()]
                tm = re.search(r'N\.\s?' + num + r'\s?-\s?(.+?)(?:\n\s*\n|Fir)', pre, re.S)
                ttl = pulisci(tm.group(1)).rstrip('.') if tm else None
                if not ttl:
                    tm2 = re.search(r'(?:avente per oggetto|oggetto)[:\s"“«]*([^"”»]{10,220})["”»]', ans, re.I) or re.search(r'Interrogazione[^"“]{0,120}["“](.+?)["”]', ans)
                    ttl = tm2.group(1).strip() if tm2 else 'Interrogazione n. ' + num
                fm = re.search(r'F\S{0,3}(?:rm|rn)\S{0,3}tari\s*:\s*(.+?)(?:\n\s*\n)', pre, re.S)
                names = []
                if fm:
                    for raw in re.split(r'[;,]', fm.group(1).replace('\n', ' ')):
                        nm = nomi.correggi(raw)
                        if nm and nm not in names:
                            names.append(nm)
                if re.search(r'\[|@|PROT|MITTENTE|DESTINATAR|Data:|ore \d\d[:.]\d\d|\d{5,}', ttl, re.I) or len(ttl) < 12:
                    ttl = 'Interrogazione n. ' + num
                items[k] = dict(k=k, tipo='I', n=int(num), t=ttl, d=d, f=names, a=[], s=int(sn), dr=True,
                                c=luoghi(ttl + ' ' + ans[:3000], ttl), p=page_at(m.start()), src=SRC)
    # numeri impossibili letti male nelle risposte (es. numeri di protocollo): fuori
    max_i = max([it['n'] for it in items.values() if it['tipo'] == 'I' and not it.get('dr')] or [0])
    for k in [k for k, it in items.items() if it.get('dr') and it['n'] > max_i + 40]:
        items.pop(k)
        texts.pop(k, None)
    for k in [k for k in texts if k[0] == 'I' and int(k[1:]) > max_i + 40 and k not in items]:
        texts.pop(k)
    for k, it in items.items():
        if k in texts and 'risp' in texts[k]:
            it['r'] = texts[k]['risp']['d']
    return items, texts


def resoconti(cache):
    """Voti finali dei disegni di legge, risposte in Aula, date e stato (provvisorio) dei resoconti."""
    votes, oral, sedute = [], {}, {}
    for f in sorted(glob.glob(os.path.join(cache, 'res', '*.txt')), key=numero_file):
        n = numero_file(f)
        t = open(f, encoding='utf-8', errors='ignore').read()
        head = t[:3000]
        days = re.findall(r'(LUNEDÌ|MARTEDÌ|MERCOLEDÌ|GIOVEDÌ|VENERDÌ|SABATO|DOMENICA)\s+(\d{1,2})\s+([A-Z]+)\s+(\d{4})', head)
        dates = [x for x in (data_ok(y, MESI[m.lower()], d) for _, d, m, y in days if m.lower() in MESI) if x]
        if not dates:
            m = re.search(r'(\d{1,2}) (gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre) (\d{4})', head)
            if m:
                dates = [x for x in [data_ok(m.group(3), MESI[m.group(2)], m.group(1))] if x]
        sedute[n] = {'date': dates, 'provvisorio': 'provvisoria' in head.lower()}

        def page_at(pos):
            return t.count('\f', 0, pos) + 1

        def date_at(pos):
            seg = t[max(0, pos - 6000):pos + 200]
            ms = re.findall(r'\d+a\s+SEDUTA\s+([\d\-– ]+?)\s*(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})', seg)
            if ms:
                ds, mo, y = ms[-1]
                d = re.findall(r'\d+', ds)[-1]
                x = data_ok(y, MESI[mo], d)
                if x:
                    return x
            return dates[-1] if dates else None
        titles = {}
        for m in re.finditer(r'[“"]([^”"]{8,400})[”"]\s*\(n+\.\s*([\d\-–/A-Za-z ]+?)\)', pulisci_breve(t[:30000])):
            num = re.match(r'\d+', m.group(2).strip())
            if num:
                titles.setdefault(num.group(0), m.group(1).strip())
        seen = set()
        for m in re.finditer(r'(?:^|\n)\s*(?:PRESIDENTE\.\s*)?(?:Si passa alla\s+)?[Vv]otazione finale (?:per scrutinio (?:nominale|segreto) |per appello nominale )?del(?:l[ae])? disegn[oi] di legge', t):
            seg0 = t[m.end():m.end() + 700]
            hd = seg0[:400]
            par = list(re.finditer(r'\(\s*nn?\.\s*([0-9][^)]{0,70})\)', hd))
            if par:
                nm = par[0]
            else:
                q = re.search(r'[”"]', hd)
                start = q.end() if q else 0
                nm = re.search(r'nn?\.\s*([0-9][^\n)]{0,60})', hd[start:]) if not hd.lstrip().startswith(('“', '"')) or q else None
                if not nm:
                    nm = re.search(r'^\s*([0-9]{2,4}[^\n]{0,40})', seg0)
            if not nm:
                continue
            lab = pulisci_breve(nm.group(1)).strip(' :.,')
            nums = re.findall(r'\d{2,4}', lab)
            if not nums:
                continue
            num = nums[0]
            seg = t[m.end():m.end() + 5000]
            cut = re.search(r'[Vv]otazione finale', seg[50:])
            if cut:
                seg = seg[:50 + cut.start()]

            def g(k):
                mm = re.search(k + r'[\s.]*?(\d+)', seg)
                return int(mm.group(1)) if mm else None
            fav, con = g('Favorevoli'), g('Contrari')
            no = re.search(r'non approva|è respint|viene respint|\(Non è approvat', seg, re.I)
            yes = re.search(r'L.Assemblea approva|\(È approvat|È approvat', seg)
            if fav is None and not yes and not no:
                continue
            ok = (yes is not None and (no is None or yes.start() < no.start())) or (no is None and fav is not None and con is not None and fav > con)
            if (n, num) in seen:
                continue
            seen.add((n, num))
            titm = re.search(r'[“"]([^”"]{8,400})[”"]', seg0)
            votes.append(dict(seduta=n, data=date_at(m.start()), ddl=num, label=lab,
                              titolo=(titm.group(1).strip() if titm else titles.get(num, '')),
                              presenti=g('Presenti'), votanti=g('Votanti'), favorevoli=fav, contrari=con,
                              astenuti=g('Astenuti'), approvato=ok, pagina=page_at(m.start())))
        for m in re.finditer(r"(?:Si passa all.|iniziamo con l.|passiamo all.|si passa all.)\s*interrogazione\s*(?:n\.|numero)?\s*(\d{3,4})", t, re.I):
            num = m.group(1)
            k = 'I' + num
            nxt = re.search(r"(?:Si passa all.|passiamo all.)\s*(?:interrogazione|interpellanza)|Si passa al [IVX]+ punto", t[m.end():], re.I)
            end = m.end() + (nxt.start() if nxt else 8000)
            seg = t[m.start():min(end, m.start() + 12000)]
            st = 'svolta'
            inizio = seg[:900]
            parla = re.search(r'per rispondere|per fornire la risposta|ha facoltà di parlare l.assessore|assessore per [a-z]', inizio, re.I)
            if re.search(r'parzialmente svolta', seg, re.I):
                st = 'parzialmente svolta'
            elif re.search(r'trasform\w*\s+(?:\w+\s+){0,3}in\s+interrogazion\w*\s+(?:con\s+richiesta\s+di|a)\s+risposta\s+scritta', inizio, re.I) and not parla:
                st = 'trasformata'
            elif re.search(r'(è|viene) rinviata|differire la risposta|rinviamo', seg, re.I) and not re.search(r'per rispondere', seg[:600]):
                st = 'rinviata'
            if not re.search(r'rispondere|risposta|assessore', seg[:1500], re.I):
                continue
            prev = oral.get(k)
            rk = {'svolta': 3, 'parzialmente svolta': 2, 'trasformata': 1, 'rinviata': 0}
            if not prev or rk[st] > rk[prev['stato']] or (rk[st] == rk[prev['stato']] and rk[st] < 2):
                oral[k] = dict(seduta=n, data=date_at(m.start()), stato=st, pagina=page_at(m.start()), txt=pulisci_breve(seg)[:6000])
    return votes, oral, sedute


def odg_sedute(cache):
    """Punti all'ordine del giorno (prima pagina dell'OdG) di ogni seduta."""
    out = {}
    for f in glob.glob(os.path.join(cache, 'odg', '*.txt')):
        n = numero_file(f)
        t = open(f, encoding='utf-8', errors='ignore').read()
        first = t.split('\f')[0]
        m = re.search(r'(?s)ORDINE DEL GIORNO(.*)', first)
        body = m.group(1) if m else ''
        body = re.split(r'ALLEGATO|N\.B\.', body)[0]
        items = [pulisci_breve(x) for x in re.split(r'\n\s*(?=[IVX]+\s*[-–.]\s)', body) if pulisci_breve(x)]
        out[n] = [re.sub(r'^[IVX]+\s*[-–.]\s*', '', x)[:400] for x in items][:8]
    return out


TITOLO_VUOTO = re.compile(r'^(interrogazione|interpellanza|mozione)( parlamentare)?\s*(n\.?|numero)?\s*\d*\s*[-–]?\s*$', re.I)


def legge_id(seduta, ddl):
    return 'L' + str(seduta) + '-' + re.sub(r'\W+', '', ddl)


def costruisci(cache, deputati, conv):
    """Tutti i record pronti per ars_import."""
    nomi = Nomi(deputati)
    items, texts = atti_da_documenti(cache, nomi)
    votes, oral, sed_res = resoconti(cache)
    odg_items = odg_sedute(cache)
    urls, resurl = leggi_links(cache)
    sdate, giorni = leggi_sedute(cache)
    gruppo_attuale = {d['nome']: gruppo_breve(d.get('gruppo')) for d in deputati if d.get('in_carica')}

    # titoli dei ddl (allegati, punti dell'OdG, convocazioni delle commissioni)
    title = {str(x['n']): x['t'] for x in items.values() if x['tipo'] == 'D'}
    for lst in odg_items.values():
        for it in lst:
            for m in re.finditer(r'[“"]([^”"]{8,400})[”"]\s*\(n+\.\s*(\d+)', it):
                title.setdefault(m.group(2), m.group(1).strip())
    for c in conv:
        for m in re.finditer(r'disegn[oi] di legge n+\.\s*(\d+)[^“"]{0,40}[“"]([^”"]{8,300})[”"]', c['odg']):
            title.setdefault(m.group(1), m.group(2).strip())
    # percorso dei ddl in commissione
    iter_ = {}
    for c in conv:
        if c['disdetta']:
            continue
        for m in re.finditer(r'disegn[oi] di legge (?:nn?\.\s*)?([\d][\d,\s\-–e/A-Za-z]{0,80})', c['odg']):
            for num in re.findall(r'\b(\d{2,4})\b', m.group(1)):
                iter_.setdefault(num, set()).add((c['d'], c['comm']))
    iter_ = {k: sorted(v) for k, v in iter_.items()}

    # leggi votate
    testi = testi_ddl(cache)
    leggi = []
    visti = set()
    for v in votes:
        nums = re.findall(r'\d+', v['label'])
        main = nums[0] if nums else v['ddl']
        t = v['titolo'] or title.get(main, '')
        lab = re.split(r'[«“"]', v['label'])[0].strip(' -–,')
        t = re.sub(r'\s+', ' ', t or '').strip()
        if re.match(r'^118\b', lab) and not t:
            continue
        lid = legge_id(v['seduta'], lab)
        if lid in visti:
            continue
        visti.add(lid)
        tutti = [x for x in dict.fromkeys(nums or [main]) if len(x) >= 2]
        comm = sorted({tuple(x) for n_ in tutti for x in iter_.get(n_, []) if not v['data'] or x[0] <= v['data']})
        pres = sorted(filter(None, [(items.get('D' + n_) or {}).get('dp') or (items.get('D' + n_) or {}).get('d') for n_ in tutti]))
        testo = testi.get((v['seduta'], main)) or next((tx for (sn_, n_), tx in testi.items() if n_ == main), None)
        leggi.append(dict(id=lid, ddl=lab, num=main, titolo=t or None, data=v['data'], seduta=v['seduta'],
                          approvata=v['approvato'], favorevoli=v['favorevoli'], contrari=v['contrari'],
                          astenuti=v['astenuti'], presenti=v['presenti'], pagina=v['pagina'],
                          commissione=(comm[-1][1] if comm else (iter_[main][-1][1] if iter_.get(main) else None)),
                          percorso={'ddl': tutti, 'presentato': pres[0] if pres else None, 'commissione': [list(x) for x in comm]},
                          testo=(testo[:120000] if testo else None)))
    votato = {}
    for l in sorted(leggi, key=lambda x: x['data'] or ''):
        for n in re.findall(r'\d+', l['ddl']):
            votato[n] = l

    # sedute
    sedute = {}
    for n in set(list(sdate) + [str(x) for x in odg_items] + [str(x) for x in sed_res]):
        try:
            ni = int(n)
        except ValueError:
            continue
        sedute[ni] = dict(n=ni, data=sdate.get(str(ni)), giorni=sorted(giorni.get(str(ni), [])),
                          odg=odg_items.get(ni, []), odg_url=urls.get(str(ni)), res_url=resurl.get(str(ni)),
                          provvisorio=(sed_res.get(ni) or {}).get('provvisorio'))

    allurl = url_allegati(cache)

    def url_doc(it):
        if it['src'] == 'r':
            return resurl.get(str(it['s']))
        if it['src'] == 'a':
            return allurl.get(str(it['s'])) or resurl.get(str(it['s']))
        return urls.get(str(it['s'])) or f"https://w3.ars.sicilia.it/DocumentiEsterni/ODG_PDF/ODG_18_{it['d'].replace('-', '_')}_{it['s']}_P.pdf"

    atti = []
    for k, it in items.items():
        tx = texts.get(k, {})
        o = oral.get(k)
        tit = it['t']
        if TITOLO_VUOTO.match(tit.strip()):
            tit = f"{TIPI[it['tipo']]} n. {it['n']} (titolo non leggibile nel documento)"
        f = it['f'] if isinstance(it['f'], list) else []
        rec = dict(k=k, tipo=it['tipo'], n=it['n'], titolo=tit, data=it['d'], data_presentazione=it.get('dp') or None,
                   firmatari=f, iniziativa=(it['f'] if isinstance(it['f'], str) and it['f'] else None),
                   gruppo=(gruppo_attuale.get(f[0]) if f else None),
                   destinatari=(it['a'] if isinstance(it['a'], list) else []),
                   commissione=(it['a'] if isinstance(it['a'], str) and it['a'] else None),
                   seduta=it['s'], luoghi=it['c'], pagina=it.get('p') or 1, fonte=it['src'], url_doc=url_doc(it),
                   iter=None, testo=tx.get('txt'), risposta=tx.get('risp'), orale=o,
                   ha_risposta=bool(tx.get('risp') or (o and o['stato'] in ('svolta', 'parzialmente svolta'))))
        if it['tipo'] == 'D':
            n = str(it['n'])
            if n in votato:
                rec['iter'] = {'stato': 'votato', 'data': votato[n]['data'], 'approvata': votato[n]['approvata'], 'legge': votato[n]['id'],
                               'commissione': [list(x) for x in iter_.get(n, [])]}
            elif n in iter_:
                rec['iter'] = {'stato': 'commissione', 'data': iter_[n][-1][0], 'commissione_nome': iter_[n][-1][1],
                               'commissione': [list(x) for x in iter_[n]]}
        atti.append(rec)
    # interrogazioni note solo dal resoconto (chiamate in Aula ma non trovate negli allegati)
    presenti = {a['k'] for a in atti}
    for k, o in oral.items():
        if k in presenti:
            continue
        num = k[1:]
        tm = re.search(r'n\.\s*' + num + r'\s*[“"«]([^”"»]{8,400})[”"»]', o['txt'])
        tit = pulisci_breve(tm.group(1)).rstrip('.') if tm else f'Interrogazione n. {num} (titolo non leggibile nel documento)'
        fm = re.search(r'a firma de(?:ll.onorevole|gli onorevoli|lla onorevole|l deputato)\s+([A-ZÀ-Ü][^.,;]{1,60}?)(?:\s+ed altri|[.,;])', o['txt'])
        firm = []
        if fm:
            for pezzo in re.split(r',| e ', fm.group(1)):
                c = nomi.cognomi.get(nz(pezzo.strip()), [])
                if len(c) == 1 and c[0] not in firm:
                    firm.append(c[0])
        atti.append(dict(k=k, tipo='I', n=int(num), titolo=tit, data=o['data'], data_presentazione=None,
                         firmatari=firm, iniziativa=None, gruppo=(gruppo_attuale.get(firm[0]) if firm else None),
                         destinatari=[], commissione=None, seduta=o['seduta'], luoghi=luoghi(tit + ' ' + o['txt'][:2500], tit),
                         pagina=o['pagina'], fonte='r', url_doc=resurl.get(str(o['seduta'])), iter=None, testo=None,
                         risposta=None, orale=o, ha_risposta=o['stato'] in ('svolta', 'parzialmente svolta')))
    atti.sort(key=lambda x: (x['data'] or '', x['n']), reverse=True)
    return dict(atti=atti, leggi=leggi, sedute=sorted(sedute.values(), key=lambda s: s['n']), iter=iter_)
