/**
 * NUKUN — Stockage local des audits (navigateur uniquement).
 * Rien n'est transmis à un serveur. Chaque lecture/écriture est protégée :
 * en navigation privée ou si le stockage est plein, l'application continue
 * de fonctionner en mémoire et prévient l'utilisateur.
 */
import { sanitizeImported, resolveAssessments } from '../modules/audit-engine/audit-engine.js';

const KEY = 'nukun.audits.v1';
const CURRENT = 'nukun.current.v1';
let memory = { audits: {}, current: null };
let persistent = true;

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    const out = {};
    for (const [id, a] of Object.entries(obj || {})) {
      const clean = sanitizeImported(a);
      if (clean) {
        // On conserve l'analyse locale déjà validée par cette application.
        if (a.analysis && a.analysis.version) { clean.analysis = a.analysis; clean.automatic = a.automatic || clean.automatic; }
        clean.reference = a.reference || null;
        resolveAssessments(clean);
        clean.updatedAt = typeof a.updatedAt === 'string' ? a.updatedAt : clean.updatedAt;
        out[id] = clean;
      }
    }
    return out;
  } catch {
    persistent = false;
    return memory.audits;
  }
}

export function isPersistent() { return persistent; }

export function listAudits() {
  const all = read();
  memory.audits = all;
  return Object.values(all).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export function getAudit(id) {
  return read()[id] || memory.audits[id] || null;
}

export function saveAudit(audit) {
  memory.audits[audit.id] = audit;
  try {
    const all = read();
    all[audit.id] = audit;
    localStorage.setItem(KEY, JSON.stringify(all));
    localStorage.setItem(CURRENT, audit.id);
    persistent = true;
    return { ok: true };
  } catch (e) {
    persistent = false;
    return { ok: false, message: 'Sauvegarde locale impossible (stockage plein ou désactivé). L\'audit reste disponible tant que la page est ouverte : exportez-le.' };
  }
}

export function deleteAudit(id) {
  delete memory.audits[id];
  try {
    const all = read();
    delete all[id];
    localStorage.setItem(KEY, JSON.stringify(all));
    if (localStorage.getItem(CURRENT) === id) localStorage.removeItem(CURRENT);
  } catch { /* ignoré */ }
}

export function deleteAll() {
  memory = { audits: {}, current: null };
  try { localStorage.removeItem(KEY); localStorage.removeItem(CURRENT); } catch { /* ignoré */ }
}

export function currentAuditId() {
  try { return localStorage.getItem(CURRENT); } catch { return memory.current; }
}

export function setCurrent(id) {
  memory.current = id;
  try { localStorage.setItem(CURRENT, id); } catch { /* ignoré */ }
}
