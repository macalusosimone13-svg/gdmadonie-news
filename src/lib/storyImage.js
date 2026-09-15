// Genera l'immagine da condividere su Instagram/Facebook per un articolo
// qualsiasi, sia esso un comunicato GD Madonie che un articolo di rassegna di
// un altro giornale. Supporta due formati, perche' Storie e Post del feed
// hanno proporzioni diverse (una storia verticale stretta, se pubblicata nel
// feed, taglia via il logo in alto e il testo in basso):
//   'story' -> 1080x1920 (9:16), per le Storie
//   'post'  -> 1080x1350 (4:5, il pi\u00f9 alto formato ammesso nel feed), per un post normale
// Tutti i testi/colori del marchio sono parametrici (vengono da
// StoryShareConfig, modificabile da Admin), con valori di riserva sensati se
// la configurazione non e' ancora stata impostata.
//
// Quando l'articolo non ha una foto (o non si legge per CORS), invece di
// lasciare gran parte dell'immagine vuota si dà priorità al testo scritto:
// titolo ed estratto vengono mostrati grandi, al centro, riempiendo lo
// spazio che altrimenti sarebbe una foto.
//
// Nota importante sulle foto/logo: molte immagini (specie da testate esterne,
// ma a volte anche il logo del sito) non permettono di leggerne i pixel da un
// altro dominio (CORS): il caricamento riesce (onload scatta) ma "sporca" il
// canvas, e l'errore emerge solo dopo, al momento di esportare l'immagine
// finale (toBlob). Per questo, se l'esportazione fallisce, si ricostruisce
// tutto su un foglio NUOVO e pulito, stavolta senza foto ne' logo (solo testo),
// cosi' la condivisione riesce sempre.
export const FORMATS = {
  story: { width: 1080, height: 1920 },
  post: { width: 1080, height: 1350 }
};

export const STORY_DEFAULTS = {
  brand_title: 'Madonie News',
  brand_subtitle: 'Giovani Democratici Madonie',
  logo_url: '',
  bg_gradient_start: '#2a3f6b',
  bg_gradient_end: '#0a1226',
  domain_text_gd: 'gdmadonie-news.com',
  domain_text_rassegna_prefix: 'via',
  category_bg_color: '#ffffff',
  category_text_color: '#0F1B3A',
  title_color: '#ffffff',
  overlay_intensity: 0.85,
  show_category: true,
  show_domain: true,
  top_band_enabled: false,
  top_band_color: '#000000',
  top_band_opacity: 0.35,
  logo_size: 140,
  category_gap: 40
};

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// Controlla SUBITO se un'immagine gia' caricata puo' essere letta dal canvas
// (permessi CORS), invece di scoprirlo solo alla fine con l'intero export
// (toBlob) che fallirebbe buttando via anche i loghi che invece funzionano.
// Prova su un minuscolo canvas 1x1: se il sito che ospita l'immagine non
// permette la lettura dei pixel, qui lancia un errore subito, e si passa al
// pallino colorato solo per QUESTA immagine, lasciando le altre intatte.
function isImageTainted(img) {
  try {
    const testCanvas = document.createElement('canvas');
    testCanvas.width = 1;
    testCanvas.height = 1;
    const testCtx = testCanvas.getContext('2d');
    testCtx.drawImage(img, 0, 0, 1, 1);
    testCanvas.toDataURL();
    return false;
  } catch {
    return true;
  }
}

function wrapText(ctx, text, maxWidth) {
  const words = (text || '').split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function hexToRgba(hex, alpha) {
  const m = (hex || '#000000').replace('#', '');
  const r = parseInt(m.slice(0, 2), 16) || 0;
  const g = parseInt(m.slice(2, 4), 16) || 0;
  const b = parseInt(m.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}

// Sfondi chiari (es. bianco, grigio chiaro) resterebbero illeggibili con
// testo bianco: qui si calcola la luminosita' del colore per scegliere da
// solo se il testo sopra deve essere bianco o scuro.
function isLightColor(hex) {
  const m = (hex || '').replace('#', '');
  if (m.length < 6) return false;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return false;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6;
}

// Accorcia un testo con "..." se non entra nella larghezza data, cosi' un
// nome lungo non finisce mai per essere scritto SOPRA la barra colorata che
// gli sta accanto.
function truncateToWidth(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = text.slice(0, mid) + '…';
    if (ctx.measureText(candidate).width <= maxWidth) lo = mid;else
    hi = mid - 1;
  }
  return lo > 0 ? text.slice(0, lo) + '…' : '…';
}

function drawBase(ctx, W, H, primaryColor, gradStart, gradEnd) {
  const grad = ctx.createLinearGradient(0, 0, W * 0.3, H);
  grad.addColorStop(0, gradStart || '#2a3f6b');
  grad.addColorStop(0.55, primaryColor || '#0F1B3A');
  grad.addColorStop(1, gradEnd || '#0a1226');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

// Fascia semi-trasparente sopra, dietro al logo: aiuta il logo a risaltare
// anche su foto molto chiare o molto "rumorose", indipendentemente dal velo
// scuro in basso (che copre solo la parte bassa dell'immagine).
function drawTopBand(ctx, W, color, opacity) {
  const bandH = 320;
  const grad = ctx.createLinearGradient(0, 0, 0, bandH);
  grad.addColorStop(0, hexToRgba(color, opacity));
  grad.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, bandH);
}

// Marchio in alto a sinistra, grande: prova a usare il logo (dentro un
// quadrato bianco con angoli arrotondati, come l'header del sito); se non si
// carica (rete/CORS), disegna un badge testuale "GD" cosi' il marchio non
// manca mai. Passare logoUrl=null forza sempre il badge testuale (usato nel
// ripiego, per evitare di sporcare di nuovo il canvas con un'immagine che ha
// gia' fallito una volta).
async function drawBrandBadge(ctx, logoUrl, brandTitle, brandSubtitle, logoSize, textColor, subTextColor) {
  logoSize = logoSize || 140;
  const logoX = 64;
  const logoY = 90;
  const radius = Math.round(logoSize * 0.2);
  let logoDrawn = false;
  if (logoUrl) {
    try {
      const logoImg = await loadImage(logoUrl);
      if (isImageTainted(logoImg)) throw new Error('tainted');
      ctx.save();
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(logoX, logoY, logoSize, logoSize, radius);
      else ctx.rect(logoX, logoY, logoSize, logoSize);
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(logoX, logoY, logoSize, logoSize);
      const s = Math.max(logoSize / logoImg.width, logoSize / logoImg.height);
      const lw = logoImg.width * s;
      const lh = logoImg.height * s;
      ctx.drawImage(logoImg, logoX + (logoSize - lw) / 2, logoY + (logoSize - lh) / 2, lw, lh);
      ctx.restore();
      logoDrawn = true;
    } catch {
      // si ripiega sul badge testuale qui sotto
    }
  }
  if (!logoDrawn) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(logoX, logoY, logoSize, logoSize, radius);
    else ctx.rect(logoX, logoY, logoSize, logoSize);
    ctx.fill();
    ctx.fillStyle = '#0F1B3A';
    ctx.font = '700 56px -apple-system, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText('GD', logoX + logoSize / 2, logoY + logoSize / 2 + 2);
    ctx.textAlign = 'left';
  }
  const textX = logoX + logoSize + 28;
  const titleFontSize = Math.round(logoSize * 0.33);
  const subtitleFontSize = Math.round(logoSize * 0.23);
  if (brandTitle) {
    ctx.fillStyle = textColor || '#ffffff';
    ctx.font = `700 ${titleFontSize}px -apple-system, sans-serif`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(brandTitle, textX, logoY + logoSize / 2 - 4);
  }
  if (brandSubtitle) {
    ctx.fillStyle = subTextColor || 'rgba(255,255,255,0.75)';
    ctx.font = `400 ${subtitleFontSize}px -apple-system, sans-serif`;
    ctx.fillText(brandSubtitle, textX, logoY + logoSize / 2 + titleFontSize - 6);
  }
}

function drawCategoryPill(ctx, x, y, category, categoryBg, categoryText) {
  ctx.font = '700 26px -apple-system, sans-serif';
  const padX = 22;
  const textW = ctx.measureText(category.toUpperCase()).width;
  const pillW = textW + padX * 2;
  const pillH = 54;
  ctx.fillStyle = categoryBg || '#ffffff';
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, pillW, pillH, 999) : ctx.rect(x, y, pillW, pillH);
  ctx.fill();
  ctx.fillStyle = categoryText || '#0F1B3A';
  ctx.textBaseline = 'middle';
  ctx.fillText(category.toUpperCase(), x + padX, y + pillH / 2 + 2);
  return pillH;
}

// Layout "solo testo": usato quando l'articolo non ha una foto (o non si
// legge). Invece di lasciare vuota gran parte dell'immagine, dà priorità al
// testo scritto: titolo grande ed estratto occupano lo spazio centrale.
function drawTextOnlyCard(ctx, W, H, { category, title, bodyText, domain, categoryBg, categoryText, titleColor, showCategory, showDomain }) {
  const left = 64;
  const right = W - 64;
  const maxWidth = right - left;
  let y = 300;

  if (category && showCategory !== false) {
    const pillH = drawCategoryPill(ctx, left, y, category, categoryBg, categoryText);
    y += pillH + 36;
  }

  if (title) {
    ctx.fillStyle = titleColor || '#ffffff';
    ctx.font = '700 58px Georgia, serif';
    ctx.textBaseline = 'alphabetic';
    const lines = wrapText(ctx, title, maxWidth).slice(0, 6);
    lines.forEach((line) => {
      y += 66;
      ctx.fillText(line, left, y);
    });
    y += 50;
  }

  if (bodyText) {
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.font = '400 34px -apple-system, sans-serif';
    ctx.textBaseline = 'alphabetic';
    const bottomLimit = H - (showDomain !== false && domain ? 170 : 110);
    const lines = wrapText(ctx, bodyText, maxWidth);
    for (const line of lines) {
      y += 46;
      if (y > bottomLimit) break;
      ctx.fillText(line, left, y);
    }
  }

  if (domain && showDomain !== false) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '400 28px -apple-system, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(domain, left, H - 100);
  }
}

function drawTextBlock(ctx, W, H, { category, title, domain, categoryBg, categoryText, titleColor, overlayIntensity, showCategory, showDomain, categoryGap }) {
  // Velo scuro in basso per far risaltare il testo sopra qualunque foto.
  // L'intensita' e' regolabile da admin (0 = quasi trasparente, 1 = quasi nero).
  // Parte piuttosto in basso (62% dell'altezza) perche' la foto ora viene
  // mostrata intera e non a tutto schermo: se il velo cominciasse a meta',
  // finirebbe per scurire la parte bassa della foto stessa.
  const intensity = overlayIntensity == null ? 0.85 : overlayIntensity;
  const overlay = ctx.createLinearGradient(0, H * 0.62, 0, H);
  overlay.addColorStop(0, 'rgba(0,0,0,0)');
  overlay.addColorStop(0.45, `rgba(0,0,0,${(intensity * 0.7).toFixed(2)})`);
  overlay.addColorStop(1, `rgba(0,0,0,${intensity.toFixed(2)})`);
  ctx.fillStyle = overlay;
  ctx.fillRect(0, H * 0.62, W, H - H * 0.62);

  let y = H - 100;

  if (domain && showDomain !== false) {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '400 28px -apple-system, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(domain, 64, y);
    y -= 60;
  }

  if (title) {
    ctx.fillStyle = titleColor || '#ffffff';
    ctx.font = '700 52px Georgia, serif';
    const lines = wrapText(ctx, title, W - 128).slice(0, 4);
    y -= (lines.length - 1) * 62;
    const titleTop = y;
    lines.forEach((line, i) => {
      ctx.fillText(line, 64, titleTop + i * 62);
    });
    y = titleTop - (categoryGap == null ? 40 : categoryGap);
  }

  if (category && showCategory !== false) {
    const pillH = 54;
    drawCategoryPill(ctx, 64, y - pillH, category, categoryBg, categoryText);
  }
}

// Variante "foto pulita": quando l'immagine ha gia' la sua grafica (scritte,
// loghi, cornici fatte a mano), le sovrapposizioni del sito la coprirebbero
// rovinandola. Qui si rinuncia a logo, categoria e titolo e si lascia solo il
// nome del sito in basso, con un velo appena accennato: quanto basta per
// rendere leggibile la scritta senza scurire la foto.
function drawDomainOnly(ctx, W, H, { domain, showDomain }) {
  if (!domain || showDomain === false) return;
  const bandTop = H - 200;
  const overlay = ctx.createLinearGradient(0, bandTop, 0, H);
  overlay.addColorStop(0, 'rgba(0,0,0,0)');
  overlay.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = overlay;
  ctx.fillRect(0, bandTop, W, H - bandTop);
  // Stessa identica posizione e stile del riquadro normale (in basso a
  // sinistra, a 64px dal bordo): cambia solo cio' che sta sopra, non dove
  // compare il nome del sito.
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '400 28px -apple-system, sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillText(domain, 64, H - 62);
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('toBlob failed')), 'image/png');
  });
}

async function renderPollChart(ctx, W, H, { category, title, subtitle, items, domain, primaryColor, logoUrl, brandTitle, brandSubtitle, bgGradientStart, bgGradientEnd, categoryBg, categoryText, titleColor, logoSize, showCategory, showDomain, topBandEnabled, topBandColor, topBandOpacity, categoryGap, drawLogos }) {
  drawBase(ctx, W, H, primaryColor, bgGradientStart, bgGradientEnd);
  const light = isLightColor(primaryColor);
  const mainText = light ? '#0F1B3A' : '#ffffff';
  const dimText = light ? 'rgba(15,27,58,0.72)' : 'rgba(255,255,255,0.75)';
  const faintText = light ? 'rgba(15,27,58,0.55)' : 'rgba(255,255,255,0.6)';
  await drawBrandBadge(ctx, drawLogos ? logoUrl : null, brandTitle, brandSubtitle, logoSize, mainText, dimText);
  if (topBandEnabled) drawTopBand(ctx, W, topBandColor, topBandOpacity == null ? 0.35 : topBandOpacity);

  const left = 64;
  const right = W - 64;
  let y = (logoSize || 140) + 90 + 76;

  if (category && showCategory !== false) {
    const pillH = drawCategoryPill(ctx, left, y, category, categoryBg, categoryText);
    y += pillH + (categoryGap == null ? 28 : categoryGap);
  }

  if (title) {
    ctx.fillStyle = titleColor || mainText;
    ctx.font = '700 54px Georgia, serif';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    y += 54;
    ctx.fillText(title, left, y);
  }

  if (subtitle) {
    ctx.fillStyle = dimText;
    ctx.font = '400 28px -apple-system, sans-serif';
    y += 44;
    ctx.fillText(subtitle, left, y);
  }

  y += 46;

  const bottomMargin = domain && showDomain !== false ? 100 : 56;
  const availableH = H - y - bottomMargin;
  const rows = items; // si mostrano SEMPRE tutti i partiti/candidati, mai tagliati
  // Righe piu' strette (fino a un minimo leggibile) quando ce ne sono tante,
  // cosi' entrano tutte invece di perderne alcune in fondo.
  const rowH = Math.max(46, Math.min(108, availableH / Math.max(rows.length, 1)));
  const shrink = rowH < 108;
  const nameFontSize = Math.round(Math.min(32, rowH * 0.32));
  const subFontSize = Math.round(Math.min(26, rowH * 0.24));
  const pctFontSize = Math.round(Math.min(30, rowH * 0.3));
  const maxPct = Math.max(...rows.map((r) => r.percentage || 0), 1);

  const logoR = Math.round(Math.min(30, rowH * 0.32));
  const barLeft = left + 340;
  const barRight = right - 110;
  const barMaxW = Math.max(60, barRight - barLeft);
  const nameX = left + logoR * 2 + 24;
  const nameMaxW = Math.max(40, barLeft - nameX - 16);

  for (const item of rows) {
    const cy = y + rowH / 2;

    let logoDrawn = false;
    if (drawLogos && item.logo_url) {
      try {
        const img = await loadImage(item.logo_url);
        if (isImageTainted(img)) throw new Error('tainted');
        ctx.save();
        ctx.beginPath();
        ctx.arc(left + logoR, cy, logoR, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(left, cy - logoR, logoR * 2, logoR * 2);
        const s = Math.max(logoR * 2 / img.width, logoR * 2 / img.height);
        const lw = img.width * s;
        const lh = img.height * s;
        ctx.drawImage(img, left + logoR - lw / 2, cy - lh / 2, lw, lh);
        ctx.restore();
        logoDrawn = true;
      } catch {
        // logo non leggibile (CORS/rete): si passa al pallino colorato qui sotto
      }
    }
    if (!logoDrawn) {
      ctx.fillStyle = item.color || '#ffffff';
      ctx.beginPath();
      ctx.arc(left + logoR, cy, logoR, 0, Math.PI * 2);
      ctx.fill();
    }

    const lines = (item.party || '').split('\n').slice(0, 2);
    ctx.textAlign = 'left';
    if (lines.length === 1) {
      ctx.fillStyle = mainText;
      ctx.font = `700 ${nameFontSize}px -apple-system, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.fillText(truncateToWidth(ctx, lines[0], nameMaxW), nameX, cy);
    } else {
      ctx.fillStyle = mainText;
      ctx.font = `700 ${nameFontSize}px -apple-system, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.fillText(truncateToWidth(ctx, lines[0], nameMaxW), nameX, cy - rowH * 0.16);
      ctx.fillStyle = dimText;
      ctx.font = `400 ${subFontSize}px -apple-system, sans-serif`;
      ctx.fillText(truncateToWidth(ctx, lines[1], nameMaxW), nameX, cy + rowH * 0.16);
    }

    const barW = Math.max(6, item.percentage / maxPct * barMaxW);
    const barH = shrink ? Math.max(14, rowH * 0.28) : 26;
    ctx.fillStyle = item.color || mainText;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(barLeft, cy - barH / 2, barW, barH, 8);else
    ctx.rect(barLeft, cy - barH / 2, barW, barH);
    ctx.fill();

    ctx.fillStyle = mainText;
    ctx.font = `700 ${pctFontSize}px -apple-system, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(`${item.percentage}%`, barLeft + barW + 16, cy);

    y += rowH;
  }

  if (domain && showDomain !== false) {
    ctx.fillStyle = faintText;
    ctx.font = '400 26px -apple-system, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'right';
    ctx.fillText(domain, right, H - 56);
    ctx.textAlign = 'left';
  }
}

export async function buildPollChartBlob(opts) {
  const { format = 'story' } = opts;
  const { width: W, height: H } = FORMATS[format] || FORMATS.story;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  await renderPollChart(ctx, W, H, { ...opts, drawLogos: true });

  try {
    return await canvasToBlob(canvas);
  } catch {
    // Uno o piu' loghi (di partito o del sito) non permettono di leggerne i
    // pixel da un altro dominio (CORS): il caricamento riesce ma "sporca" il
    // canvas, e l'errore emerge solo qui, all'esportazione. Si ricostruisce
    // tutto su un foglio nuovo, stavolta senza NESSUN logo (solo pallini
    // colorati e badge testuale), che non puo' mai fallire per questo motivo.
    const fallbackCanvas = document.createElement('canvas');
    fallbackCanvas.width = W;
    fallbackCanvas.height = H;
    const ctx2 = fallbackCanvas.getContext('2d');
    await renderPollChart(ctx2, W, H, { ...opts, drawLogos: false });
    return await canvasToBlob(fallbackCanvas);
  }
}

export async function buildStoryBlob({
  imageUrl, category, title, bodyText, domain, primaryColor,
  logoUrl, brandTitle, brandSubtitle, bgGradientStart, bgGradientEnd,
  categoryBg, categoryText, titleColor, overlayIntensity, showCategory, showDomain,
  topBandEnabled, topBandColor, topBandOpacity, logoSize, categoryGap,
  minimal = false,
  format = 'story'
}) {
  const { width: W, height: H } = FORMATS[format] || FORMATS.story;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  let photoDrawn = false;
  if (imageUrl) {
    try {
      const img = await loadImage(imageUrl);

      // Sfondo: la stessa foto, molto sfocata e scurita, solo per riempire lo
      // spazio sopra e sotto. Deve risultare chiaramente "fuori fuoco",
      // altrimenti sembra una seconda immagine invece di uno sfondo.
      //
      // Il metodo: la foto viene prima ridisegnata dentro una tela minuscola
      // (poche decine di pixel) e poi ringrandita. Nel rimpicciolire, il
      // browser fonde insieme i pixel vicini; nel ringrandire li sfuma. Il
      // risultato e' una sfocatura morbida che funziona SU QUALSIASI
      // dispositivo — a differenza di ctx.filter, che Safari su iPhone non ha
      // supportato per anni e dove percio' lo sfondo restava nitido.
      // ctx.filter, quando c'e', viene comunque aggiunto sopra per ammorbidire
      // ulteriormente.
      const tiny = document.createElement('canvas');
      tiny.width = 28;
      tiny.height = Math.max(1, Math.round(28 * img.height / img.width));
      tiny.getContext('2d').drawImage(img, 0, 0, tiny.width, tiny.height);

      const coverScale = Math.max(W / tiny.width, H / tiny.height);
      const bw = tiny.width * coverScale * 1.2;
      const bh = tiny.height * coverScale * 1.2;
      ctx.save();
      if (typeof ctx.filter === 'string') ctx.filter = 'blur(60px)';
      ctx.drawImage(tiny, (W - bw) / 2, (H - bh) / 2, bw, bh);
      ctx.restore();
      ctx.fillStyle = 'rgba(10,18,38,0.62)';
      ctx.fillRect(0, 0, W, H);

      // Foto vera: SEMPRE intera, mai tagliata, e il piu' grande possibile.
      // Si usa Math.min ("contain") invece di Math.max ("cover"): con cover la
      // foto veniva ingrandita fino a coprire tutto e cosi' le si tagliavano i
      // lati. Il confronto e' con l'INTERA tela (W e H), non con una fascia
      // ridotta: cosi' una foto orizzontale prende tutta la larghezza e restano
      // scoperti solo i margini sopra e sotto (riempiti dallo sfondo sfocato),
      // invece di venire rimpicciolita per stare dentro uno spazio piu' stretto.
      const fitScale = Math.min(W / img.width, H / img.height);
      const dw = img.width * fitScale;
      const dh = img.height * fitScale;
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
      photoDrawn = true;
    } catch {
      // Foto non caricabile (CORS o rete): si procede con il solo brand qui sotto.
    }
  }

  // "minimal" (foto pulita) vale solo se la foto c'e' davvero: senza foto
  // resterebbe un'immagine quasi vuota, quindi in quel caso si torna al
  // normale riquadro con titolo e testo.
  const clean = minimal && photoDrawn;

  if (photoDrawn) {
    if (clean) {
      drawDomainOnly(ctx, W, H, { domain, showDomain });
    } else {
      drawTextBlock(ctx, W, H, { category, title, domain, categoryBg, categoryText, titleColor, overlayIntensity, showCategory, showDomain, categoryGap });
      if (topBandEnabled) drawTopBand(ctx, W, topBandColor, topBandOpacity == null ? 0.35 : topBandOpacity);
    }
  } else {
    drawBase(ctx, W, H, primaryColor, bgGradientStart, bgGradientEnd);
    drawTextOnlyCard(ctx, W, H, { category, title, bodyText, domain, categoryBg, categoryText, titleColor, showCategory, showDomain });
  }
  if (!clean) await drawBrandBadge(ctx, logoUrl, brandTitle, brandSubtitle, logoSize);

  try {
    return await canvasToBlob(canvas);
  } catch {
    // Il canvas e' stato "sporcato" da una foto o dal logo senza i permessi
    // giusti (CORS): si ricostruisce tutto su un foglio NUOVO, stavolta senza
    // ne' foto ne' logo (solo testo), che non puo' mai fallire per questo
    // motivo, cosi' la condivisione riesce comunque.
    const fallbackCanvas = document.createElement('canvas');
    fallbackCanvas.width = W;
    fallbackCanvas.height = H;
    const ctx2 = fallbackCanvas.getContext('2d');
    drawBase(ctx2, W, H, primaryColor, bgGradientStart, bgGradientEnd);
    drawTextOnlyCard(ctx2, W, H, { category, title, bodyText, domain, categoryBg, categoryText, titleColor, showCategory, showDomain });
    await drawBrandBadge(ctx2, null, brandTitle, brandSubtitle, logoSize);
    return await canvasToBlob(fallbackCanvas);
  }
}
