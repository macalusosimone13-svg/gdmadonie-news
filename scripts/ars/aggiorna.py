"""Aggiornamento automatico della sezione ARS del sito.

Gira ogni 30 minuti su GitHub Actions (.github/workflows/ars-aggiorna.yml):
  1. scarica dal sito dell'ARS solo le novita' (scarica.py);
  2. rilegge tutti i documenti in cache e ricostruisce atti, leggi, sedute
     (analizza.py, pochi secondi);
  3. manda al database del sito solo le righe cambiate dall'ultima volta
     (funzione ars-import di Supabase), che poi spedisce gli "Avvisami".

Uso:  python3 aggiorna.py --cache CARTELLA [--senza-rete] [--silenzioso] [--tutto]
  --senza-rete  non scarica nulla (usa la cache cosi' com'e')
  --silenzioso  nessun avviso email (primo caricamento)
  --tutto       rimanda tutte le righe, non solo quelle cambiate
"""
import argparse
import hashlib
import json
import os
import re
import sys
import time
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import analizza  # noqa: E402
import scarica  # noqa: E402

URL_IMPORT = 'https://fxfckcpdxuyrhuinkyxq.supabase.co/functions/v1/ars-import'
MAX_BYTES = 900_000
MAX_RIGHE = 150


def token_github():
    u, t = os.environ.get('ACTIONS_ID_TOKEN_REQUEST_URL'), os.environ.get('ACTIONS_ID_TOKEN_REQUEST_TOKEN')
    if not u or not t:
        return None
    req = urllib.request.Request(u + '&audience=ars-import', headers={'Authorization': 'bearer ' + t})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)['value']


_tok = {'v': None, 't': 0}


def intestazioni():
    h = {'Content-Type': 'application/json'}
    if os.environ.get('ACTIONS_ID_TOKEN_REQUEST_URL'):
        if not _tok['v'] or time.time() - _tok['t'] > 200:  # il token dura 5 minuti
            _tok['v'], _tok['t'] = token_github(), time.time()
        h['Authorization'] = 'Bearer ' + _tok['v']
    elif os.environ.get('ARS_IMPORT_SECRET'):
        h['x-ars-secret'] = os.environ['ARS_IMPORT_SECRET']
    else:
        raise SystemExit('Manca la credenziale per ars-import (OIDC di GitHub o ARS_IMPORT_SECRET)')
    return h


def invia(corpo):
    dati = json.dumps(corpo, ensure_ascii=False).encode()
    for tentativo in range(1, 5):
        try:
            req = urllib.request.Request(URL_IMPORT, data=dati, headers=intestazioni(), method='POST')
            with urllib.request.urlopen(req, timeout=150) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            msg = e.read().decode('utf-8', 'ignore')[:300]
            if e.code in (500, 502, 503, 504, 546) and tentativo < 4:
                time.sleep(5 * tentativo)
                continue
            raise RuntimeError(f'ars-import {e.code}: {msg}')
        except Exception:
            if tentativo < 4:
                time.sleep(5 * tentativo)
                continue
            raise


def pezzi(righe):
    pezzo, peso = [], 0
    for r in righe:
        b = len(json.dumps(r, ensure_ascii=False).encode())
        if pezzo and (peso + b > MAX_BYTES or len(pezzo) >= MAX_RIGHE):
            yield pezzo
            pezzo, peso = [], 0
        pezzo.append(r)
        peso += b
    if pezzo:
        yield pezzo


def impronta(r):
    return hashlib.sha1(json.dumps(r, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:16]


GRUPPI_BREVI = analizza.GRUPPI_BREVI


def pulisci_ruolo(r):
    r = r.replace('Commissione Commissione', 'Commissione')
    r = re.sub(r'^Componente Commissione', 'Componente della commissione', r)
    r = re.sub(r'^Vice[ -]Presidente Commissione', 'Vicepresidente della commissione', r)
    r = re.sub(r'^Presidente Commissione', 'Presidente della commissione', r)
    r = re.sub(r'^Segretario Commissione', 'Segretario della commissione', r)
    r = re.sub(r'^Vice[ -]Presidente Gruppo Parlamentare', 'Vicepresidente del gruppo', r)
    r = re.sub(r'^Presidente Gruppo Parlamentare', 'Presidente del gruppo', r)
    return re.sub(r"Commissione parlamentare speciale per l.esame dei disegni di legge di modifica dello Statuto.*", 'commissione speciale sullo Statuto', r)


def priorita(r):
    if r.startswith('Assessore') or 'Presidente della Regione' in r:
        return 0
    if r.startswith('Presidente') and 'Vice' not in r:
        return 1
    if r.startswith('Vicepresidente') or r.startswith('Segretario') or r.startswith('Questore'):
        return 2
    return 3


def righe_deputati(deputati, atti):
    primo = {}
    for a in atti:  # gia' in ordine dal piu' recente
        if a['firmatari'] and a['tipo'] != 'D':
            primo.setdefault(a['firmatari'][0], [])
            if len(primo[a['firmatari'][0]]) < 3:
                primo[a['firmatari'][0]].append({'k': a['k'], 'titolo': a['titolo'], 'data': a['data']})
    out = []
    for d in deputati:
        ruoli = sorted({pulisci_ruolo(r) for r in d.get('cariche', [])}, key=lambda r: (priorita(r), r))
        out.append(dict(nome=d['nome'], gruppo=d.get('gruppo'), gruppo_breve=analizza.gruppo_breve(d.get('gruppo')),
                        lista=d.get('lista'), voti=d.get('voti'), collegio=d.get('collegio'), url=d.get('url'),
                        in_carica=bool(d.get('in_carica', True)),
                        palermo=(d.get('collegio') or '').lower().startswith('palermo'),
                        ruoli=ruoli, recenti=primo.get(d['nome'], [])))
    return out


def righe_convocazioni(conv):
    return [dict(id=scarica.conv_id(c), data=c['d'], foglio=c['foglio'], commissione=c['comm'], odg=c['odg'], disdetta=c['disdetta']) for c in conv]


def esegui(cache, rete=True, silenzioso=False, tutto=False):
    t0 = time.time()
    errori = []
    giro = {}
    if rete:
        giro = scarica.esegui(cache)
        errori += [k for k, v in giro.items() if v == 'errore']
    deputati = scarica.leggi_json(os.path.join(cache, 'deputati.json'), [])
    conv = scarica.leggi_json(os.path.join(cache, 'conv.json'), [])
    dati = analizza.costruisci(cache, deputati, conv)

    tabelle = {
        'sedute': ([s for s in dati['sedute'] if s['data']], lambda r: str(r['n'])),
        'atti': (dati['atti'], lambda r: r['k']),
        'leggi': (dati['leggi'], lambda r: r['id']),
        'convocazioni': (righe_convocazioni(conv), lambda r: r['id']),
        'deputati': (righe_deputati(deputati, dati['atti']), lambda r: r['nome']),
    }
    mp = os.path.join(cache, 'manifest.json')
    manifest = scarica.leggi_json(mp, {})
    riepilogo = {'atti_nuovi': 0, 'atti_cambiati': 0, 'risposte': 0, 'leggi_cambiate': 0, 'sedute_nuove': 0, 'avvisi': 0}
    for tab, (righe, chiave) in tabelle.items():
        visti = manifest.get(tab, {})
        nuovo_m = {}
        da_mandare = []
        for r in righe:
            k = chiave(r)
            h = impronta(r)
            nuovo_m[k] = h
            if tutto or visti.get(k) != h:
                da_mandare.append(r)
        tolte = [k for k in visti if k not in nuovo_m]
        if tab == 'sedute':
            riepilogo['sedute_nuove'] = sum(1 for r in da_mandare if str(r['n']) not in visti)
        # invio a pezzi
        inviate = {}
        def manda(pezzo):
            try:
                res = invia({'tabella': tab, 'righe': pezzo, 'silenzioso': silenzioso})
            except Exception as e:
                if len(pezzo) > 1 and 'ars-import 500' in str(e):
                    # una riga rovinata non deve bloccare le altre: si divide e si riprova
                    meta = len(pezzo) // 2
                    manda(pezzo[:meta])
                    manda(pezzo[meta:])
                    return
                errori.append(f'{tab} {chiave(pezzo[0]) if len(pezzo) == 1 else ""}: {e}'[:300])
                scarica.log('ERRORE invio', tab, e)
                return
            for x in pezzo:
                inviate[chiave(x)] = True
            if tab == 'atti':
                riepilogo['atti_nuovi'] += res.get('nuovi', 0)
                riepilogo['atti_cambiati'] += res.get('scritte', 0)
                riepilogo['risposte'] += res.get('risposte', 0)
            if tab == 'leggi':
                riepilogo['leggi_cambiate'] += res.get('scritte', 0)
            riepilogo['avvisi'] += sum((res.get('avvisi') or {}).values())

        for pezzo in pezzi(da_mandare):
            manda(pezzo)
        if tolte and tab in ('convocazioni', 'sedute'):
            try:
                invia({'tabella': tab + '_tolte', 'righe': tolte})
            except Exception as e:
                errori.append(f'{tab}_tolte: {e}')
        # nel manifest solo cio' che e' arrivato davvero
        m = {k: (nuovo_m[k] if (k in inviate or visti.get(k) == nuovo_m[k]) else visti.get(k)) for k in nuovo_m}
        manifest[tab] = {k: v for k, v in m.items() if v}
        scarica.scrivi_json(mp, manifest)
        scarica.log(f'{tab}: {len(righe)} righe, {len(da_mandare)} cambiate, {len(inviate)} inviate, {len(tolte)} tolte')

    conteggi = {
        'atti': len(dati['atti']), 'leggi': sum(1 for l in dati['leggi'] if l['approvata']),
        'risposte': sum(1 for a in dati['atti'] if a['ha_risposta']), 'sedute': len(dati['sedute']),
        'convocazioni': len(conv), 'deputati': len(deputati),
    }
    riepilogo.update({'conteggi': conteggi, 'giro': giro, 'errori': errori, 'secondi': round(time.time() - t0),
                      'log': scarica.LOG[-40:]})
    try:
        invia({'fine': True, 'riepilogo': riepilogo})
    except Exception as e:
        scarica.log('ERRORE riepilogo', e)
    return riepilogo


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--cache', required=True)
    ap.add_argument('--senza-rete', action='store_true')
    ap.add_argument('--silenzioso', action='store_true')
    ap.add_argument('--tutto', action='store_true')
    a = ap.parse_args()
    r = esegui(a.cache, rete=not a.senza_rete, silenzioso=a.silenzioso, tutto=a.tutto)
    print(json.dumps({k: v for k, v in r.items() if k != 'log'}, ensure_ascii=False, indent=1))
    out = os.environ.get('GITHUB_OUTPUT')
    if out:
        with open(out, 'a') as f:
            f.write(f"errori={len(r['errori'])}\n")
