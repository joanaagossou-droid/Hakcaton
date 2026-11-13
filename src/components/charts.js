/**
 * NUKUN — Graphiques SVG légers (aucune bibliothèque) : jauge, radar,
 * répartition des critères, niveaux de preuve, barres de piliers.
 * Chaque graphique porte un titre accessible et ses valeurs sont aussi
 * données en texte à côté (tableaux, légendes).
 */
import { h } from '../utils/dom.js';

export const COLORS = { red: '#c62828', orange: '#e07b00', green: '#1f8a4c', grey: '#8a95a5', navy: '#0b1f3a', teal: '#0f9488', teal2: '#14b8a6', line: '#dde3ea', after: '#0f9488', before: '#c62828' };
const lightColor = (s) => (s >= 80 ? COLORS.green : s >= 50 ? COLORS.orange : COLORS.red);

function polar(cx, cy, r, angle) {
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
}

/** Jauge demi-cercle 0–100 avec zones 50 et 80. */
export function gauge(score, { label = 'Score global' } = {}) {
  const cx = 120, cy = 118, r = 92, w = 18;
  const arc = (from, to, color, width = w) => {
    const a0 = Math.PI + (from / 100) * Math.PI;
    const a1 = Math.PI + (to / 100) * Math.PI;
    const [x0, y0] = polar(cx, cy, r, a0);
    const [x1, y1] = polar(cx, cy, r, a1);
    return h('path', { d: `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`, fill: 'none', stroke: color, 'stroke-width': width, 'stroke-linecap': 'butt' });
  };
  const s = Math.max(0, Math.min(100, score));
  return h('svg', { class: 'chart', viewBox: '0 0 240 150', role: 'img', 'aria-label': `${label} : ${score} sur 100` },
    h('title', null, `${label} : ${score} sur 100`),
    arc(0, 49.6, 'rgba(196,43,43,.18)'), arc(50, 79.6, 'rgba(224,123,0,.2)'), arc(80, 100, 'rgba(26,127,70,.2)'),
    s > 0 ? arc(0, s, lightColor(score), 10) : null,
    h('text', { x: cx, y: cy - 18, 'text-anchor': 'middle', 'font-size': 40, 'font-weight': 800, fill: lightColor(score) }, String(score)),
    h('text', { x: cx, y: cy + 2, 'text-anchor': 'middle', 'font-size': 12, class: 'c-muted' }, 'sur 100'),
    h('text', { x: 22, y: 140, 'font-size': 10, class: 'c-muted' }, '0'),
    h('text', { x: 212, y: 140, 'font-size': 10, class: 'c-muted' }, '100')
  );
}

/** Radar des six piliers ; series = [{label, color, values:{C:..}}]. */
export function radar(pillars, series) {
  const cx = 170, cy = 150, R = 105;
  const n = pillars.length;
  const ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const g = [];
  for (const lvl of [25, 50, 75, 100]) {
    const pts = pillars.map((_, i) => polar(cx, cy, (R * lvl) / 100, ang(i)).map((v) => v.toFixed(1)).join(',')).join(' ');
    g.push(h('polygon', { points: pts, fill: 'none', class: lvl === 100 ? 'c-line c-bg' : 'c-line', 'stroke-width': 1 }));
  }
  pillars.forEach((p, i) => {
    const [x, y] = polar(cx, cy, R, ang(i));
    g.push(h('line', { x1: cx, y1: cy, x2: x.toFixed(1), y2: y.toFixed(1), class: 'c-line' }));
    const [lx, ly] = polar(cx, cy, R + 24, ang(i));
    g.push(h('text', { x: lx.toFixed(1), y: (ly + 4).toFixed(1), 'text-anchor': Math.abs(lx - cx) < 10 ? 'middle' : lx > cx ? 'start' : 'end', 'font-size': 12, 'font-weight': 700, class: 'c-ink' }, p.id));
    const [sx, sy] = polar(cx, cy, R + 24, ang(i));
    g.push(h('text', { x: sx.toFixed(1), y: (sy + 17).toFixed(1), 'text-anchor': Math.abs(sx - cx) < 10 ? 'middle' : sx > cx ? 'start' : 'end', 'font-size': 9.5, class: 'c-muted' }, shortPillar(p.name)));
  });
  for (const s of series) {
    const pts = pillars.map((p, i) => polar(cx, cy, (R * (s.values[p.id] ?? 0)) / 100, ang(i)).map((v) => v.toFixed(1)).join(',')).join(' ');
    g.push(h('polygon', { points: pts, fill: s.color, 'fill-opacity': 0.18, stroke: s.color, 'stroke-width': 2.2 }));
    pillars.forEach((p, i) => {
      const [x, y] = polar(cx, cy, (R * (s.values[p.id] ?? 0)) / 100, ang(i));
      g.push(h('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 3.2, fill: s.color }));
    });
  }
  const desc = series.map((s) => `${s.label} : ` + pillars.map((p) => `${p.name} ${s.values[p.id] === null || s.values[p.id] === undefined ? 'N/A' : Math.round(s.values[p.id]) + ' %'}`).join(', ')).join(' ; ');
  return h('svg', { class: 'chart', viewBox: '0 0 340 310', role: 'img', 'aria-label': `Radar des six piliers. ${desc}` }, h('title', null, desc), ...g);
}

function shortPillar(name) {
  return { 'Confidentialité et données': 'Confidentialité', 'Sécurité par défaut': 'Sécurité', 'Accessibilité et inclusion': 'Accessibilité', 'Recours et contrôle humain': 'Recours', 'Ne pas nuire': 'Ne pas nuire', 'Équité et fiabilité': 'Équité' }[name] || name;
}

/** Anneau de répartition des critères par statut. */
export function donut(counts) {
  const parts = [
    { k: 'conform', label: 'Conformes', color: COLORS.green },
    { k: 'partial', label: 'Partiels', color: COLORS.orange },
    { k: 'nonconform', label: 'Non conformes', color: COLORS.red },
    { k: 'unverified', label: 'Non vérifiés', color: '#b7c0cc' },
    { k: 'na', label: 'N/A', color: '#e3e7ed' }
  ];
  const total = parts.reduce((s, p) => s + (counts[p.k] || 0), 0) || 1;
  const cx = 80, cy = 80, r = 60, w = 24;
  let a = -Math.PI / 2;
  const segs = [];
  for (const p of parts) {
    const v = counts[p.k] || 0;
    if (!v) continue;
    const a1 = a + (v / total) * 2 * Math.PI - (v === total ? 0.0001 : 0);
    const [x0, y0] = polar(cx, cy, r, a);
    const [x1, y1] = polar(cx, cy, r, a1);
    segs.push(h('path', { d: `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${a1 - a > Math.PI ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`, fill: 'none', stroke: p.color, 'stroke-width': w }));
    a = a1;
  }
  const desc = parts.map((p) => `${p.label} ${counts[p.k] || 0}`).join(', ');
  const svg = h('svg', { class: 'chart', viewBox: '0 0 160 160', role: 'img', 'aria-label': `Répartition des 30 critères : ${desc}` },
    h('title', null, desc), ...segs,
    h('text', { x: cx, y: cy + 2, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 800, class: 'c-ink' }, String(counts.conform || 0)),
    h('text', { x: cx, y: cy + 18, 'text-anchor': 'middle', 'font-size': 10, class: 'c-muted' }, 'conformes'));
  const legend = h('div', { class: 'legend' }, parts.map((p) => h('span', null, h('i', { style: { background: p.color } }), `${p.label} : ${counts[p.k] || 0}`)));
  return h('div', null, svg, legend);
}

/** Barre empilée des niveaux de preuve. */
export function proofBar(pc) {
  const parts = [
    { k: 'machine', label: '🤖 Machine', color: '#4f7cff' },
    { k: 'human', label: '🧪 Humain', color: COLORS.teal },
    { k: 'declared', label: '💬 Déclaration', color: '#e0a100' },
    { k: 'none', label: 'Non évalué', color: '#9aa5b5' }
  ];
  const total = parts.reduce((s, p) => s + (pc[p.k] || 0), 0) || 1;
  let x = 0;
  const rects = parts.map((p) => {
    const w = ((pc[p.k] || 0) / total) * 300;
    const r = h('rect', { x: x.toFixed(1), y: 0, width: w.toFixed(1), height: 26, fill: p.color });
    x += w;
    return r;
  });
  const desc = parts.map((p) => `${p.label.replace(/^\S+ /, '')} ${pc[p.k] || 0}`).join(', ');
  return h('div', null,
    h('svg', { class: 'chart', viewBox: '0 0 300 26', preserveAspectRatio: 'none', role: 'img', 'aria-label': `Niveaux de preuve : ${desc}` }, h('title', null, desc), ...rects),
    h('div', { class: 'legend' }, parts.map((p) => h('span', null, h('i', { style: { background: p.color } }), `${p.label} : ${pc[p.k] || 0}`))));
}

/** Barres horizontales des piliers (texte + barre, lisibles sans graphique). */
export function pillarBars(pillars) {
  return h('div', { class: 'stack' }, pillars.map((p) => {
    const tone = p.percent === null ? '' : p.percent >= 80 ? 'green' : p.percent >= 50 ? 'orange' : 'red';
    return h('div', null,
      h('div', { class: 'row between small' }, h('span', null, h('b', null, p.id), ' · ', p.name, h('span', { class: 'muted' }, ` (${p.weight} %${p.effectiveWeight && p.effectiveWeight !== p.weight ? `, ${p.effectiveWeight} % après renormalisation` : ''})`)), h('b', null, p.percent === null ? 'N/A' : `${Math.round(p.percent)} %`)),
      h('div', { class: ['progress', tone], role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': p.percent ?? 0, 'aria-label': p.name }, h('span', { style: { width: `${p.percent ?? 0}%` } })));
  }));
}
