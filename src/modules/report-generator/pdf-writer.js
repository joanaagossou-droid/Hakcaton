/**
 * NUKUN — Générateur PDF minimal, local, sans dépendance (module pur).
 *
 * Produit un vrai fichier PDF 1.4 (A4) avec les polices standard Helvetica et
 * Helvetica-Bold (encodage WinAnsi, accents français pris en charge), du texte
 * avec retour à la ligne, des rectangles et des traits. Aucune donnée ne quitte
 * l'appareil. Les caractères hors WinAnsi (émojis…) sont remplacés.
 */

// Largeurs Helvetica (AFM standard), caractères 32 à 126, en 1/1000 em.
const W = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];

const WIN = { '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, 'Œ': 0x8c, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '™': 0x99, 'œ': 0x9c, 'Ÿ': 0x9f };
const SUBST = { '✓': 'OK', '✗': 'X', '→': '->', '←': '<-', '≥': '>=', '≤': '<=', '≈': '~', ' ': ' ', ' ': ' ', ' ': ' ', '🤖': '[M]', '🧪': '[H]', '💬': '[D]', '🔴': '[ROUGE]', '🟠': '[ORANGE]', '🟢': '[VERT]', '✕': 'X', '⚠': '!', '✅': 'OK', '❌': 'X', '⚠️': '!' };

/** Convertit une chaîne en octets WinAnsi (tableau de nombres). */
export function toWinAnsi(str) {
  const out = [];
  for (const chRaw of String(str).normalize('NFC')) {
    let ch = chRaw;
    if (SUBST[ch] !== undefined) { for (const c of SUBST[ch]) out.push(...toWinAnsi(c)); continue; }
    const code = ch.codePointAt(0);
    if (code >= 32 && code <= 126) out.push(code);
    else if (WIN[ch]) out.push(WIN[ch]);
    else if (code >= 0xa0 && code <= 0xff) out.push(code);
    else if (code === 10 || code === 9) out.push(32);
    else if (code >= 0xfe00 && code <= 0xfe0f) continue; // sélecteurs de variante
    else {
      const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
      const bc = base.codePointAt(0);
      out.push(base && bc >= 32 && bc <= 126 ? bc : 63);
    }
  }
  return out;
}

function charWidth(b, bold) {
  let w;
  if (b >= 32 && b <= 126) w = W[b - 32];
  else if (b === 0x97) w = 1000;
  else if (b === 0x96 || b === 0x95) w = 556;
  else if (b >= 0xc0) w = 600;
  else w = 556;
  return bold ? w * 1.06 : w;
}

export function textWidth(str, size, bold = false) {
  return toWinAnsi(str).reduce((s, b) => s + charWidth(b, bold), 0) * size / 1000;
}

export function pdfString(bytes) {
  let s = '(';
  for (const b of bytes) {
    if (b === 0x28 || b === 0x29 || b === 0x5c) s += '\\' + String.fromCharCode(b);
    else if (b < 32 || b > 126) s += '\\' + b.toString(8).padStart(3, '0');
    else s += String.fromCharCode(b);
  }
  return s + ')';
}

const hexToRgb = (hex) => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => (parseInt(h.slice(i, i + 2), 16) / 255).toFixed(3)).join(' ');
};

export class PdfDoc {
  constructor({ title = 'Rapport NUKUN', footer = '' } = {}) {
    this.pageW = 595.28; this.pageH = 841.89;
    this.margin = 48;
    this.pages = [];
    this.title = title;
    this.footer = footer;
    this.addPage();
  }

  addPage() {
    this.ops = [];
    this.pages.push(this.ops);
    this.y = this.pageH - this.margin;
  }

  ensure(h) { if (this.y - h < this.margin + 30) this.addPage(); }

  text(x, y, str, { size = 10, bold = false, color = '#14213d' } = {}) {
    this.ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${hexToRgb(color)} rg ${x.toFixed(2)} ${y.toFixed(2)} Td ${pdfString(toWinAnsi(str))} Tj ET`);
  }

  rect(x, y, w, h, color) { this.ops.push(`${hexToRgb(color)} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`); }

  line(x1, y1, x2, y2, color = '#cfd8e3', width = 0.6) { this.ops.push(`${hexToRgb(color)} RG ${width} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`); }

  wrap(str, maxW, size, bold) {
    const words = String(str).replace(/\s+/g, ' ').trim().split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (textWidth(t, size, bold) <= maxW || !cur) {
        if (!cur && textWidth(w, size, bold) > maxW) {
          // mot trop long : coupe dure
          let part = '';
          for (const ch of w) { if (textWidth(part + ch, size, bold) > maxW) { lines.push(part); part = ch; } else part += ch; }
          cur = part;
        } else cur = t;
      } else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [''];
  }

  /** Paragraphe avec retour à la ligne et saut de page automatique. */
  para(str, { size = 10, bold = false, color = '#14213d', x = this.margin, width = this.pageW - 2 * this.margin, gap = 4, lead = 1.35 } = {}) {
    for (const l of this.wrap(str, width, size, bold)) {
      this.ensure(size * lead);
      this.y -= size * lead;
      this.text(x, this.y, l, { size, bold, color });
    }
    this.y -= gap;
  }

  heading(str, level = 1) {
    const size = level === 1 ? 16 : level === 2 ? 13 : 11;
    this.ensure(size * 3 + 60); // évite un titre orphelin en bas de page
    this.y -= level === 1 ? 10 : 6;
    this.para(str, { size, bold: true, color: level === 1 ? '#0b1f3a' : '#0d4f63', gap: level === 1 ? 4 : 2 });
    if (level === 1) { this.line(this.margin, this.y, this.pageW - this.margin, this.y, '#14b8a6', 1.2); this.y -= 6; }
  }

  bullet(str, opts = {}) {
    const size = opts.size || 10;
    const lines = this.wrap(str, this.pageW - 2 * this.margin - 14, size, false);
    lines.forEach((l, i) => {
      this.ensure(size * 1.35);
      this.y -= size * 1.35;
      if (i === 0) this.text(this.margin + 2, this.y, '•', { size, color: '#0d4f63' });
      this.text(this.margin + 14, this.y, l, { size, color: opts.color || '#14213d' });
    });
    this.y -= 2;
  }

  /** Tableau simple : colonnes {label, width (fraction)}, lignes de chaînes. */
  table(cols, rows, { size = 8.5, header = true, zebra = true } = {}) {
    const total = this.pageW - 2 * this.margin;
    const widths = cols.map((c) => c.width * total);
    const drawRow = (cells, bold, bg) => {
      const wrapped = cells.map((c, i) => this.wrap(String(c ?? ''), widths[i] - 6, size, bold));
      const h = Math.max(...wrapped.map((w) => w.length)) * size * 1.3 + 5;
      this.ensure(h);
      if (bg) this.rect(this.margin, this.y - h, total, h, bg);
      let x = this.margin;
      wrapped.forEach((lines, i) => {
        lines.forEach((l, j) => this.text(x + 3, this.y - 3 - (j + 1) * size * 1.3 + 2, l, { size, bold, color: bold ? '#0b1f3a' : '#14213d' }));
        x += widths[i];
      });
      this.y -= h;
      this.line(this.margin, this.y, this.margin + total, this.y);
    };
    if (header) drawRow(cols.map((c) => c.label), true, '#e6f4f3');
    rows.forEach((r, i) => drawRow(r, false, zebra && i % 2 ? '#f6f8fb' : null));
    this.y -= 6;
  }

  /** Barre horizontale de progression (0–100). */
  bar(label, value, color, { valueText } = {}) {
    this.ensure(18);
    this.y -= 16;
    const x0 = this.margin + 170;
    const w = this.pageW - this.margin - x0 - 50;
    this.text(this.margin, this.y + 2, label, { size: 9.5 });
    this.rect(x0, this.y, w, 9, '#e5e9f0');
    if (value !== null && value !== undefined) this.rect(x0, this.y, Math.max(0, Math.min(100, value)) / 100 * w, 9, color);
    this.text(x0 + w + 8, this.y + 1, valueText ?? (value === null ? 'N/A' : `${Math.round(value)} %`), { size: 9, bold: true });
  }

  spacer(h = 8) { this.y -= h; }

  /** Assemble le fichier PDF (chaîne binaire latin-1 → Uint8Array). */
  build() {
    const objs = [];
    const add = (s) => { objs.push(s); return objs.length; };
    const catalog = add(null);
    const pagesObj = add(null);
    const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const kids = [];
    const n = this.pages.length;
    this.pages.forEach((ops, i) => {
      const foot = [];
      const fy = 26;
      foot.push(`${hexToRgb('#cfd8e3')} RG 0.6 w ${this.margin} ${fy + 12} m ${this.pageW - this.margin} ${fy + 12} l S`);
      const ft = `${this.footer}  —  page ${i + 1}/${n}`;
      foot.push(`BT /F1 7.5 Tf ${hexToRgb('#5b6b7f')} rg ${this.margin} ${fy} Td ${pdfString(toWinAnsi(ft))} Tj ET`);
      const content = [...ops, ...foot].join('\n');
      const stream = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
      kids.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${this.pageW} ${this.pageH}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${stream} 0 R >>`));
    });
    objs[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`;
    objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
    const info = add(`<< /Title ${pdfString(toWinAnsi(this.title))} /Producer (NUKUN - generateur local) >>`);

    let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
    const offsets = [];
    objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const xref = out.length;
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) out += String(off).padStart(10, '0') + ' 00000 n \n';
    out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
    return bytes;
  }
}
