// Email "Avvisami" della sezione ARS (Resend, stesso mittente delle notifiche del sito).
export const SITE = 'https://www.gdmadonie-news.com';

export const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function emailHtml(o: { eyebrow: string; titolo: string; righe: { titolo: string; sotto?: string; link: string }[]; testo?: string; bottone?: { label: string; link: string }; annulla?: string }) {
  const righe = o.righe.map((r) =>
    `<tr><td style="padding:12px 0;border-top:1px solid #e6eaf3"><a href="${esc(r.link)}" style="color:#0F1B3A;font-weight:700;font-size:16px;text-decoration:none;line-height:1.35">${esc(r.titolo)}</a>${r.sotto ? `<div style="color:#55607D;font-size:13px;margin-top:4px">${esc(r.sotto)}</div>` : ''}</td></tr>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"></head>` +
    `<body style="margin:0;padding:0;background:#f1f4fa">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f4fa"><tr><td align="center" style="padding:28px 14px">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">` +
    `<tr><td style="background:#0F1B3A;padding:22px 26px;color:#FFFDF9;font-weight:900;letter-spacing:.06em;font-size:14px">MADONIE <span style="color:#8FB0FF">NEWS</span> · ARS</td></tr>` +
    `<tr><td style="padding:26px 26px 8px"><div style="color:#2F5BD8;font-weight:800;font-size:12px;letter-spacing:.1em;text-transform:uppercase">${esc(o.eyebrow)}</div>` +
    `<h1 style="margin:8px 0 12px;font-size:22px;line-height:1.25;color:#0A1128">${esc(o.titolo)}</h1>` +
    (o.testo ? `<p style="margin:0 0 12px;color:#334;font-size:15px;line-height:1.6">${esc(o.testo)}</p>` : '') +
    (righe ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${righe}</table>` : '') +
    (o.bottone ? `<p style="margin:22px 0 6px"><a href="${esc(o.bottone.link)}" style="display:inline-block;background:#2F5BD8;color:#fff;font-weight:700;padding:13px 26px;border-radius:999px;text-decoration:none">${esc(o.bottone.label)}</a></p>` : '') +
    `</td></tr><tr><td style="padding:18px 26px 24px;color:#94a3b8;font-size:12px;line-height:1.5">Ricevi questa email perché l'hai chiesta dalla sezione ARS di GD Madonie News. Fa fede il documento ufficiale dell'Assemblea Regionale Siciliana.` +
    (o.annulla ? `<br><a href="${esc(o.annulla)}" style="color:#64748b">Non voglio più ricevere questi avvisi</a>` : '') +
    `</td></tr></table></td></tr></table></body></html>`;
}

export async function inviaEmail(to: string, subject: string, html: string) {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) return false;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'GD Madonie News <notizie@gdmadonie-news.com>', to: [to], subject, html }),
  });
  if (!r.ok) console.error('[ars email]', r.status, (await r.text().catch(() => '')).slice(0, 200));
  return r.ok;
}
