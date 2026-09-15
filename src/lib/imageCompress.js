// Le foto scattate da telefono possono pesare diversi MB: caricarle cosi'
// com'erano rallentava il sito su connessioni deboli (frequente nelle zone
// interne). Questa funzione le ridimensiona e comprime nel browser PRIMA di
// caricarle, senza bisogno di un servizio esterno.
export function compressImage(file, { maxDim = 1600, quality = 0.82 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') {
      // SVG e GIF (animate) non vanno ricompresse: passano cosi' come sono.
      resolve(file);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        if (scale === 1 && file.size < 700 * 1024) {
          // Gia' abbastanza piccola: non serve ricomprimere.
          resolve(file);
          return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        canvas.toBlob((blob) => {
          if (!blob) {resolve(file);return;}
          if (blob.size >= file.size) {resolve(file);return;}
          const name = file.name?.replace(/\.(png|jpe?g|webp|heic)$/i, '') || 'image';
          resolve(new File([blob], `${name}.${outType === 'image/png' ? 'png' : 'jpg'}`, { type: outType }));
        }, outType, quality);
      };
      img.onerror = () => resolve(file);
      img.src = reader.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}
