/**
 * NUKUN — Pièce justificative (capture d'écran) : réduite et ré-encodée en JPEG
 * dans le navigateur. Le ré-encodage supprime les métadonnées (EXIF, position GPS).
 * L'image reste dans ce navigateur ; elle n'est jamais envoyée.
 */
export const MAX_INPUT_BYTES = 8 * 1024 * 1024;

export function readAttachment(file, maxSide = 640) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('Aucun fichier.'));
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return reject(new Error('Format accepté : image PNG, JPEG, WebP ou GIF.'));
    if (file.size > MAX_INPUT_BYTES) return reject(new Error('Image trop lourde (8 Mo au maximum).'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * scale));
      c.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      let data = c.toDataURL('image/jpeg', 0.6);
      if (data.length > 190000) data = c.toDataURL('image/jpeg', 0.4);
      if (data.length > 190000) return reject(new Error('Image trop détaillée, même réduite.'));
      resolve(data);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible.')); };
    img.src = url;
  });
}
