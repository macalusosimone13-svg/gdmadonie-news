"""Scarica dal sito dell'ARS solo quello che serve per restare aggiornati.

La cartella "cache" conserva tra un giro e l'altro:
  sedute.txt        "YYYYMMDD seduta-numero-N-del-DDMMYYYY" (giorni in cui c'e' una seduta)
  links.txt         "N|link OdG|link resoconto"
  odg/N.txt         testo dell'ordine del giorno (pdftotext -layout)
  res/N.txt         testo del resoconto stenografico
  conv.json         convocazioni delle commissioni
  deputati.json     deputati (gruppo, collegio, incarichi)
  stato.json        quando e' stato controllato cosa

Regole per non disturbare il sito dell'ARS (chiude la connessione a chi
scarica in fretta): una richiesta alla volta, pausa tra le richieste, un
numero massimo di PDF per giro. Se qualcosa non risponde si va avanti e si
riprova al giro successivo.
"""
import datetime as dt
import html
import json
import os
import re
import subprocess
import time
import urllib.parse
import urllib.request

BASE = 'https://www.ars.sicilia.it'
DATI = 'https://dati.ars.sicilia.it'
UA = 'Mozilla/5.0 (compatible; GDMadonieNews-ARS/1.0; +https://www.gdmadonie-news.com/ars)'
PAUSA = 1.0
MAX_PDF = 8          # PDF scaricati al massimo in un giro
LOG = []


def log(*a):
    s = ' '.join(str(x) for x in a)
    LOG.append(s)
    print(s, flush=True)


def adesso():
    return dt.datetime.now(dt.timezone.utc)


def iso(t):
    return t.strftime('%Y-%m-%dT%H:%M:%SZ')


def da_iso(s):
    try:
        return dt.datetime.strptime(s, '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=dt.timezone.utc)
    except Exception:
        return dt.datetime(2000, 1, 1, tzinfo=dt.timezone.utc)


def ore_da(s):
    return (adesso() - da_iso(s)).total_seconds() / 3600 if s else 1e9


_ultima = [0.0]


def get(url, data=None, timeout=90, binario=False):
    """Una richiesta al sito dell'ARS, con pausa e un secondo tentativo."""
    for tentativo in (1, 2):
        attesa = PAUSA - (time.time() - _ultima[0])
        if attesa > 0:
            time.sleep(attesa)
        try:
            body = urllib.parse.urlencode(data).encode() if data else None
            req = urllib.request.Request(url, data=body, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                out = r.read()
            _ultima[0] = time.time()
            return out if binario else out.decode('utf-8', 'ignore')
        except urllib.error.HTTPError as e:
            _ultima[0] = time.time()
            if e.code == 404:
                return None
            log('  errore', e.code, url)
        except Exception as e:  # connessione chiusa, tempo scaduto...
            _ultima[0] = time.time()
            log('  errore rete', type(e).__name__, url)
        if tentativo == 1:
            time.sleep(8)
    return None


def leggi_json(p, default):
    try:
        with open(p, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return default


def scrivi_json(p, d):
    tmp = p + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(d, f, ensure_ascii=False)
    os.replace(tmp, p)


def pdf_a_testo(pdf_bytes, dest):
    if not pdf_bytes or not pdf_bytes.startswith(b'%PDF'):
        return False
    tmp = dest + '.pdf'
    with open(tmp, 'wb') as f:
        f.write(pdf_bytes)
    try:
        subprocess.run(['pdftotext', '-layout', tmp, dest + '.tmp'], check=True, timeout=300)
        os.replace(dest + '.tmp', dest)
        return True
    except Exception as e:
        log('  pdftotext non riuscito', dest, type(e).__name__)
        return False
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass


# ---------------------------------------------------------------- sedute

def leggi_sedute(cache):
    righe = {}
    p = os.path.join(cache, 'sedute.txt')
    if os.path.exists(p):
        for l in open(p, encoding='utf-8'):
            pp = l.split()
            if len(pp) == 2:
                righe[pp[0]] = pp[1]
    return righe


def scrivi_sedute(cache, righe):
    with open(os.path.join(cache, 'sedute.txt'), 'w', encoding='utf-8') as f:
        for g in sorted(righe):
            f.write(f'{g} {righe[g]}\n')


def leggi_links(cache):
    out = {}
    p = os.path.join(cache, 'links.txt')
    if os.path.exists(p):
        for l in open(p, encoding='utf-8'):
            pp = l.strip().split('|')
            if len(pp) == 3:
                out[pp[0]] = [pp[1], pp[2]]
    return out


def scrivi_links(cache, links):
    with open(os.path.join(cache, 'links.txt'), 'w', encoding='utf-8') as f:
        for n in sorted(links, key=int):
            f.write(f'{n}|{links[n][0]}|{links[n][1]}\n')


def data_seduta(slug):
    dd = re.search(r'(\d{8})$', slug).group(1)
    return dt.date(int(dd[4:]), int(dd[2:4]), int(dd[:2]))


def controlla_giorni(cache, stato, oggi):
    """Calendario dell'Aula giorno per giorno: trova le sedute nuove (anche quelle gia' convocate)."""
    sedute = leggi_sedute(cache)
    ultimo = max((dt.date(int(g[:4]), int(g[4:6]), int(g[6:])) for g in sedute), default=dt.date(2022, 11, 9))
    if ore_da(stato.get('giorni_lungo_at')) >= 6:
        inizio, fine = min(ultimo, oggi) - dt.timedelta(days=4), oggi + dt.timedelta(days=30)
        stato['giorni_lungo_at'] = iso(adesso())
    else:
        inizio, fine = oggi - dt.timedelta(days=2), oggi + dt.timedelta(days=10)
    nuove = 0
    g = inizio
    while g <= fine:
        k = g.strftime('%Y%m%d')
        t = get(f'{BASE}/agenda/aula/{k}', timeout=40)
        if t is not None:
            m = re.findall(r'seduta-numero-\d+-del-\d{8}', t.replace('\\/', '/'))
            if m:
                if sedute.get(k) != m[0]:
                    nuove += 1
                    log('  seduta', k, m[0])
                sedute[k] = m[0]
            elif k in sedute and g >= oggi:
                # seduta futura sconvocata
                log('  seduta tolta dal calendario', k, sedute[k])
                del sedute[k]
        g += dt.timedelta(days=1)
    scrivi_sedute(cache, sedute)
    return nuove


def controlla_pagine_sedute(cache, stato, oggi):
    """Per ogni seduta recente legge dalla pagina ufficiale i link veri a OdG e resoconto."""
    sedute = leggi_sedute(cache)
    links = leggi_links(cache)
    visti = stato.setdefault('pagina_seduta', {})
    per_n = {}
    for g, slug in sedute.items():
        n = re.search(r'numero-(\d+)', slug).group(1)
        per_n.setdefault(n, slug)
    cambiati = 0
    for n, slug in sorted(per_n.items(), key=lambda x: int(x[0])):
        d = data_seduta(slug)
        cur = links.get(n)
        eta = (oggi - d).days
        if cur and cur[0] and cur[1]:
            if eta > 30 or ore_da(visti.get(n)) < 6:
                continue
        elif cur:
            # manca ancora un link: riprova piu' spesso per le sedute recenti
            if ore_da(visti.get(n)) < (3 if eta <= 30 else 24 if eta <= 120 else 24 * 7):
                continue
        t = get(f'{BASE}/agenda/sedute-aula/{slug}', timeout=60)
        visti[n] = iso(adesso())
        if t is None:
            continue
        t = t.replace('\\/', '/')
        odg = re.search(r'https://w3\.ars\.sicilia\.it/DocumentiEsterni/ODG_PDF/[^"\'\s<>]+\.pdf', t)
        res = re.search(r'https://dati\.ars\.sicilia\.it/bd/resoconti/scheda/\d+/\d+', t)
        nuovo = [odg.group(0) if odg else (cur[0] if cur else ''), res.group(0) if res else (cur[1] if cur else '')]
        if nuovo != cur:
            links[n] = nuovo
            cambiati += 1
            log('  link seduta', n, nuovo)
    scrivi_links(cache, links)
    return cambiati


def scarica_documenti(cache, stato, oggi):
    """Ordini del giorno e resoconti nuovi o cambiati (i resoconti provvisori si riscaricano)."""
    os.makedirs(os.path.join(cache, 'odg'), exist_ok=True)
    os.makedirs(os.path.join(cache, 'res'), exist_ok=True)
    sedute = leggi_sedute(cache)
    links = leggi_links(cache)
    data_n = {}
    for g, slug in sedute.items():
        n = re.search(r'numero-(\d+)', slug).group(1)
        data_n.setdefault(n, data_seduta(slug))
    st_odg = stato.setdefault('odg', {})
    st_res = stato.setdefault('res', {})
    budget = MAX_PDF
    fatti = []
    # 1) OdG: se manca, se il link e' cambiato, o se la seduta e' vicina (l'OdG viene aggiornato)
    for n in sorted(links, key=lambda x: -int(x)):
        if budget <= 0:
            break
        url = links[n][0]
        if not url:
            continue
        p = os.path.join(cache, 'odg', n + '.txt')
        info = st_odg.get(n, {})
        d = data_n.get(n)
        vicino = d is not None and -30 <= (d - oggi).days <= 2
        if os.path.exists(p) and info.get('url', url) == url and not (vicino and ore_da(info.get('at')) >= 3):
            continue
        if not os.path.exists(p) and info.get('url') == url and ore_da(info.get('at')) < 12:
            continue  # gia' provato da poco senza successo
        log('  OdG', n, url)
        ok = pdf_a_testo(get(url, timeout=180, binario=True), p)
        st_odg[n] = {'url': url, 'at': iso(adesso()), 'ok': ok}
        budget -= 1
        if ok:
            fatti.append('odg' + n)
    # 2) resoconti: nuovi o ancora provvisori
    for n in sorted(links, key=lambda x: -int(x)):
        if budget <= 0:
            break
        scheda = links[n][1]
        if not scheda:
            continue
        p = os.path.join(cache, 'res', n + '.txt')
        info = st_res.get(n, {})
        d = data_n.get(n)
        eta = (oggi - d).days if d else 999
        if os.path.exists(p):
            prov = info.get('prov')
            if prov is None:
                try:
                    prov = 'provvisoria' in open(p, encoding='utf-8', errors='ignore').read(3000).lower()
                except OSError:
                    prov = False
                info['prov'] = prov
                st_res[n] = info
            if not prov:
                continue
            ogni = 3 if eta <= 21 else 24 if eta <= 180 else 24 * 7
            if ore_da(info.get('at')) < ogni:
                continue
        elif ore_da(info.get('at')) < (2 if eta <= 30 else 24):
            continue
        t = get(scheda, timeout=60)
        if t is None:
            st_res[n] = {**info, 'at': iso(adesso())}
            continue
        info['allegati'] = allegati_scheda(t)
        f = re.search(r'/bd/resoconti/file/[^"\'&<>]+\.pdf\?id=[^"\'&<>]+', html.unescape(t))
        if not f:
            st_res[n] = {**info, 'at': iso(adesso())}
            continue
        url = DATI + f.group(0).replace(' ', '%20')
        if os.path.exists(p) and info.get('url') == url and info.get('size'):
            # stesso file: controlla se e' cambiato guardando la dimensione
            pass
        log('  resoconto', n, url)
        b = get(url, timeout=240, binario=True)
        budget -= 1
        if b and info.get('size') == len(b) and os.path.exists(p):
            st_res[n] = {**info, 'at': iso(adesso())}
            continue
        ok = pdf_a_testo(b, p)
        prov = None
        if ok:
            prov = 'provvisoria' in open(p, encoding='utf-8', errors='ignore').read(3000).lower()
            fatti.append('res' + n)
        st_res[n] = {'url': url, 'at': iso(adesso()), 'size': len(b) if b else 0, 'prov': prov}
    return fatti


def allegati_scheda(t):
    """Allegati del resoconto: Allegato A (comunicazioni: ddl presentati, interrogazioni...) e testi dei ddl votati."""
    out = []
    for m in re.finditer(r'href="([^"]*/bd/resoconti/file/[^"]+attachid=[^"]+)"[^>]*>(.*?)</a>', t, re.S):
        lab = html.unescape(re.sub(r'<[^>]+>|\s+', ' ', m.group(2)).strip())
        u = html.unescape(m.group(1))
        try:  # nomi dei file con lettere accentate scritte male (es. "martedÃ¬")
            u = u.encode('latin-1').decode('utf-8')
        except (UnicodeEncodeError, UnicodeDecodeError):
            pass
        if u.startswith('/'):
            u = DATI + u
        out.append({'l': lab, 'u': urllib.parse.quote(u, safe=':/?&=%#')})
    return out


def tipo_allegato(lab):
    """'atti' = comunicazioni con interrogazioni, ddl presentati, risposte; 'ddl' = testo di un disegno di legge."""
    if re.search(r'(?i)verbale|emendament|fascicolo|odg|ordine del giorno|pregiudiz|nota pec|questione', lab):
        return None
    if re.search(r'(?i)allegato\s*["“]?a\b|interrogazion|interpellanz|mozion|risposte scritte|comunicazion', lab):
        return 'atti'
    if re.search(r'(?i)^(?:ddl|d\.d\.l\.|disegn[oi] di legge)', lab):
        return 'ddl'
    return None


def scarica_allegati(cache, stato, oggi, budget_schede=15, budget_file=12):
    """Allegato A di ogni resoconto (atti annunciati in Aula) e testi dei disegni di legge votati."""
    os.makedirs(os.path.join(cache, 'all'), exist_ok=True)
    os.makedirs(os.path.join(cache, 'ddl'), exist_ok=True)
    links = leggi_links(cache)
    st_res = stato.setdefault('res', {})
    fatti = []
    # schede dei resoconti gia' scaricati prima che si leggessero gli allegati
    for n in sorted(links, key=lambda x: -int(x)):
        if budget_schede <= 0:
            break
        info = st_res.get(n, {})
        if 'allegati' in info or not links[n][1] or not os.path.exists(os.path.join(cache, 'res', n + '.txt')):
            continue
        t = get(links[n][1], timeout=60)
        budget_schede -= 1
        if t is None:
            continue
        info['allegati'] = allegati_scheda(t)
        st_res[n] = info
    for n in sorted(st_res, key=lambda x: -int(x)):
        if budget_file <= 0:
            break
        info = st_res[n]
        visti = info.setdefault('allegati_letti', {})
        for j, a in enumerate(info.get('allegati', [])):
            if budget_file <= 0:
                break
            lab = a['l']
            tipo = tipo_allegato(lab)
            if tipo == 'atti':
                dest = os.path.join(cache, 'all', f'{n}_{j}.txt')
            elif tipo == 'ddl':
                rp = os.path.join(cache, 'res', n + '.txt')
                try:
                    votato = 'otazione finale' in open(rp, encoding='utf-8', errors='ignore').read()
                except OSError:
                    votato = False
                if not votato:
                    continue
                num = re.sub(r'[^0-9a-z]+', '-', re.split(r'(?i)legge|ddl', lab)[-1].lower()).strip('-')[:40]
                dest = os.path.join(cache, 'ddl', f'{n}_{num}.txt')
            else:
                continue
            v = visti.get(a['u'])
            if v == 'ok' and os.path.exists(dest):
                continue
            if v and v != 'ok' and ore_da(v) < 24:
                continue  # non riuscito da poco: si riprova domani
            log('  allegato', n, lab)
            ok = pdf_a_testo(get(a['u'], timeout=180, binario=True), dest)
            budget_file -= 1
            visti[a['u']] = 'ok' if ok else iso(adesso())
            if ok:
                fatti.append(os.path.basename(dest))
    return fatti


# ---------------------------------------------------------------- commissioni

def _conv_pagina(anno, pagina):
    t = get(f'{DATI}/bd/convocazioni', data={'$Ilegislatura': '18', 'anno': str(anno), 'page': str(pagina)}, timeout=90)
    if t is None:
        return None, []
    t = re.sub(r'(?s)<(script|style|head).*?</\1>', '', t)
    x = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', t)))
    tot = re.search(r'Trovati (\d+) risultati Pagina \d+ di (\d+)', x)
    items = re.findall(r'Legisl\. XVIII Data (\d\d/\d\d/\d{4}) N\. Foglio (\d+) Commissione (.+?) Ordine del giorno (.+?)(?= Legisl\. XVIII Data|$)', x)
    out = []
    for d, f, c, o in items:
        o = re.sub(r'\s*(Footer menu|Accessibilità).*$', '', o).strip()
        out.append(dict(d=f'{d[6:]}-{d[3:5]}-{d[:2]}', foglio=int(f), comm=c.strip(), odg=o, disdetta='DISDETTA' in o[:20]))
    return (int(tot.group(2)) if tot else 1), out


def conv_id(c):
    return f"{c['d']}-{c['foglio']}-{re.sub(r'[^a-z0-9]+', '', c['comm'].lower())[:40]}"


def aggiorna_convocazioni(cache, stato, oggi):
    p = os.path.join(cache, 'conv.json')
    conv = {conv_id(c): c for c in leggi_json(p, [])}
    completo = ore_da(stato.get('conv_completo_at')) >= 24
    anni = [oggi.year] + ([oggi.year - 1] if completo and oggi.month == 1 else [])
    limite = (oggi - dt.timedelta(days=45)).isoformat()
    cambiate = 0
    for anno in anni:
        pagine, items = _conv_pagina(anno, 1)
        if pagine is None:
            continue
        lette = list(items)
        pg = 2
        while pg <= pagine:
            if not completo and lette and min(c['d'] for c in lette) < limite:
                break
            _, it = _conv_pagina(anno, pg)
            lette += it
            pg += 1
        if not lette:
            continue
        # le convocazioni del periodo letto sostituiscono quelle vecchie (una seduta puo' essere tolta o cambiata)
        dmin = min(c['d'] for c in lette) if (completo or pg <= pagine) else f'{anno}-01-01'
        dmax = max(c['d'] for c in lette)
        nuove = {conv_id(c): c for c in lette}
        for k in [k for k, c in conv.items() if c['d'][:4] == str(anno) and dmin <= c['d'] <= dmax and k not in nuove]:
            del conv[k]
            cambiate += 1
        for k, c in nuove.items():
            if conv.get(k) != c:
                conv[k] = c
                cambiate += 1
    if completo:
        stato['conv_completo_at'] = iso(adesso())
    scrivi_json(p, sorted(conv.values(), key=lambda c: (c['d'], c['foglio']), reverse=True))
    return cambiate


# ---------------------------------------------------------------- deputati

GIORNO = r'(\d\d)-(\d\d)-(\d{4})'


def _testo_scheda(t):
    t = re.sub(r'(?s)<(script|style|head).*?</\1>', '', t)
    m = re.search(r'(?s)id="main-content"(.*)', t)
    t = m.group(1) if m else t
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', t)))


def leggi_scheda(t, url):
    x = _testo_scheda(t)
    m0 = re.search(r'Profilo di (.+?) \1', x)
    if not m0:
        return None
    nome = m0.group(1)
    # solo la parte della XVIII legislatura (le schede elencano anche le precedenti)
    i = x.find('XVIII Legislatura Dati legislatura')
    if i < 0:
        i = x.find('Dati legislatura')
    sez = x[i:]
    j = re.search(r' XV?I{0,3}V?I{0,3} Legislatura Dati legislatura', sez[30:])
    if j:
        sez = sez[:30 + j.start()]
    lista = re.search(r'Eletto nella lista (.+?) Collegio', sez)
    col = re.search(r'Collegio: (.+?)(?: con voti (\d+)| Iscritto| Cariche|$)', sez)
    collegio = col.group(1).strip().title() if col else None
    if collegio and collegio.startswith('Regionale'):
        collegio = 'Regionale'
    gruppi = re.findall(r'Iscritto al gruppo (.+?) dal ' + GIORNO + r'(?: al ' + GIORNO + ')?', sez)
    attuale = [g for g in gruppi if not g[4]]
    cariche = []
    cm = re.search(r'Cariche assunte (.*?)(?: Attività parlamentari|$)', sez)
    if cm:
        for m in re.finditer(r'Dal ' + GIORNO + r'(?: al ' + GIORNO + r')? (.+?)(?= Dal \d\d-\d\d-\d{4}|$)', cm.group(1)):
            if m.group(4):
                continue  # incarico finito
            cariche.append(re.sub(r'\s+', ' ', m.group(7).replace('"', '').replace('“', '').replace('”', '')).strip())
    cess = re.search(r'(Cessat[oa][^.]{0,60}|Dimess[oa][^.]{0,60}|Decadut[oa][^.]{0,40})', sez)
    return dict(nome=nome, url=url, gruppo=(attuale[-1][0] if attuale else (gruppi[0][0] if gruppi else None)),
                lista=lista.group(1) if lista else None, collegio=collegio,
                voti=int(col.group(2)) if col and col.group(2) else None,
                cessato=cess.group(1) if cess else None, cariche=cariche)


def aggiorna_deputati(cache, stato):
    if ore_da(stato.get('deputati_at')) < 24:
        return 0
    p = os.path.join(cache, 'deputati.json')
    vecchi = {d['nome']: d for d in leggi_json(p, [])}
    t = get(f'{BASE}/xviii-legislatura', timeout=60)
    if t is None:
        return 0
    elenco = re.findall(r'href="(/deputati/[^"]+\?idLeg=71)"[^>]*>.*?<p class="nome">([^<]+)</p>\s*<p class="gruppo">([^<]*)</p>', t, re.S)
    if len(elenco) < 60:
        log('  elenco deputati non leggibile:', len(elenco))
        return 0
    in_carica = {html.unescape(n).strip(): (u, html.unescape(g).strip()) for u, n, g in elenco}
    urls = {v[0] for v in in_carica.values()} | {d['url'].replace(BASE, '') for d in vecchi.values() if d.get('url')}
    nuovi = {}
    for u in sorted(urls):
        s = get(BASE + u, timeout=60)
        if s is None:
            continue
        d = leggi_scheda(s, BASE + u)
        if not d:
            continue
        if d['nome'] in in_carica:
            d['gruppo'] = in_carica[d['nome']][1] or d['gruppo']
        d['in_carica'] = d['nome'] in in_carica
        nuovi[d['nome']] = d
    if len(nuovi) < 60:
        log('  schede deputati lette solo', len(nuovi), ': tengo le vecchie')
        return 0
    for n, d in vecchi.items():
        if n not in nuovi:
            nuovi[n] = {**d, 'in_carica': False}
    scrivi_json(p, sorted(nuovi.values(), key=lambda d: d['nome']))
    stato['deputati_at'] = iso(adesso())
    return sum(1 for n, d in nuovi.items() if vecchi.get(n) != d)


def esegui(cache, oggi=None):
    oggi = oggi or dt.datetime.now(dt.timezone(dt.timedelta(hours=2))).date()
    os.makedirs(cache, exist_ok=True)
    sp = os.path.join(cache, 'stato.json')
    stato = leggi_json(sp, {})
    r = {}
    for nome, f in (('giorni', lambda: controlla_giorni(cache, stato, oggi)),
                    ('pagine_sedute', lambda: controlla_pagine_sedute(cache, stato, oggi)),
                    ('documenti', lambda: scarica_documenti(cache, stato, oggi)),
                    ('allegati', lambda: scarica_allegati(cache, stato, oggi)),
                    ('convocazioni', lambda: aggiorna_convocazioni(cache, stato, oggi)),
                    ('deputati', lambda: aggiorna_deputati(cache, stato))):
        try:
            r[nome] = f()
        except Exception as e:
            log('ERRORE in', nome, type(e).__name__, e)
            r[nome] = 'errore'
        scrivi_json(sp, stato)
    return r
