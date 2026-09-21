// Ridisegna al volo la pagina-ponte di anteprima (WhatsApp/social) prodotta
// dalle Edge Function Supabase, nel nuovo stile blu, senza toccare quelle
// funzioni (usate anche dal sito attuale).
const CSS = `<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: 'Figtree', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0F1B3A; color: #1C2233; min-height: 100vh; }
  .wrap { max-width: 560px; margin: 0 auto; padding: 28px 16px 48px; }
  .top { text-align: left; margin: 4px 4px 20px; }
  .wm { font-family: 'Rubik', 'Arial Black', sans-serif; font-weight: 900; font-size: 30px; line-height: .95; color: #fff; text-transform: uppercase; }
  .wm span { display: block; font-size: 12px; letter-spacing: .32em; color: #7EA0FF; margin-top: 6px; font-weight: 800; }
  .card { background: #FFFDF9; border-radius: 28px; overflow: hidden; box-shadow: 0 18px 50px rgba(0,0,0,.35); }
  .hero { width: 100%; max-height: 340px; object-fit: cover; display: block; background: #DDE5FB; }
  .body { padding: 24px 22px 28px; }
  .brand { display: none; }
  h1 { font-family: 'Rubik', sans-serif; font-weight: 800; font-size: 24px; line-height: 1.15; margin: 0 0 12px; color: #0F1B3A; }
  .src { font-size: 13px; color: #5B6788; margin: 0 0 10px; font-weight: 600; }
  .meta { font-size: 14px; color: #5B6788; margin: 4px 0; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .desc { font-size: 15px; line-height: 1.6; color: #2B3350; margin-top: 12px; white-space: pre-line; }
  .btn { display: inline-block; margin-top: 24px; background: #2F5BD8; color: #fff; text-decoration: none; padding: 14px 26px; border-radius: 999px; font-family: 'Rubik', sans-serif; font-weight: 700; font-size: 15px; }
  .foot { text-align: center; font-size: 12px; color: rgba(255,255,255,.6); margin-top: 20px; }
</style>`;

export function restyleShareHtml(html: string): string {
  let out = html.replace(/<style>[\s\S]*?<\/style>/, CSS);
  out = out.replace('<div class="wrap">', '<div class="wrap">\n  <div class="top"><div class="wm">GD MADONIE<span>NEWS</span></div></div>');
  out = out.replace('</head>', '<link href="https://fonts.googleapis.com/css2?family=Rubik:wght@800;900&family=Figtree:wght@400;600&display=swap" rel="stylesheet">\n<meta name="theme-color" content="#0F1B3A">\n</head>');
  return out;
}

export async function bridge(context: any, slug: string): Promise<Response> {
  const url = new URL(context.request.url);
  const target = new URL(`https://fxfckcpdxuyrhuinkyxq.supabase.co/functions/v1/${slug}`);
  target.search = url.search;
  const resp = await fetch(target.toString(), {
    method: context.request.method,
    headers: { 'x-app-origin': url.host },
    redirect: 'manual',
  });
  const type = resp.headers.get('content-type') || '';
  if (resp.status !== 200 || !type.includes('text/html')) {
    return new Response(resp.body, { status: resp.status, headers: resp.headers });
  }
  const html = await resp.text();
  const headers = new Headers(resp.headers);
  headers.delete('content-length');
  headers.set('content-type', 'text/html; charset=utf-8');
  return new Response(restyleShareHtml(html), { status: 200, headers });
}
