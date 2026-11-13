/** NUKUN — Pages d'audit : description, analyse (module 0), 30 critères (module 1), 7 scénarios (module 2). */
import { h, toast, fmtDate } from '../utils/dom.js';
import * as store from '../utils/store.js';
import { computeScore } from '../modules/scoring/scoring.js';
import { createAudit, applyAnalysis, setManual, applyScenario, applyReference, applyReferenceScenarios, clean, AUDIT_TYPES } from '../modules/audit-engine/audit-engine.js';
import { analyze, loadSnapshot, isLocalDemo } from '../modules/url-analyzer/client.js';
import { readAttachment } from '../utils/image.js';
import { auditHeader, nextStep, requireAudit, persist, proofBadge, statusBadge, demoUrl } from '../components/ui.js';
import { go, refresh } from '../app.js';

// ---------------------------------------------------------------------------
// Étape 0 : description de l'outil
// ---------------------------------------------------------------------------
export function renderNew(ctx, params) {
  const mode = params.get('mode') === 'design' ? 'design' : 'audit';
  const presetCase = ['haven', 'safeher'].includes(params.get('cas')) ? params.get('cas') : '';
  const f = {};
  const field = (id, label, el, help) => h('div', null, h('label', { class: 'field', for: id }, label), el, help ? h('p', { class: 'help', id: id + '-help' }, help) : null);

  f.case = h('select', { id: 'case' },
    h('option', { value: '' }, 'Autre outil (adresse à saisir)'),
    h('option', { value: 'haven', selected: presetCase === 'haven' }, 'Cas fictif HAVEN (avant correction)'),
    h('option', { value: 'safeher', selected: presetCase === 'safeher' }, 'Cas fictif SafeHer (après correction)'));
  f.url = h('input', { id: 'url', type: 'url', inputmode: 'url', autocomplete: 'off', placeholder: 'https://exemple.org/', maxlength: 2048, 'aria-describedby': 'url-help' });
  f.name = h('input', { id: 'name', type: 'text', maxlength: 120, autocomplete: 'off', required: true });
  f.type = h('select', { id: 'type' }, ['Site web', 'Application mobile', 'Chatbot', 'Outil utilisant l\'IA', 'Plateforme de signalement', 'Autre'].map((x) => h('option', null, x)));
  f.func = h('input', { id: 'func', type: 'text', maxlength: 200, autocomplete: 'off', placeholder: 'Exemple : signaler un cas, s\'orienter, conserver des preuves' });
  f.aud = h('input', { id: 'aud', type: 'text', maxlength: 200, autocomplete: 'off', placeholder: 'Exemple : survivantes, proches, adolescentes' });
  f.ai = h('input', { id: 'ai', type: 'checkbox' });
  const auditType = h('fieldset', null, h('legend', null, 'Type d\'audit'),
    Object.entries(AUDIT_TYPES).map(([k, label]) => h('label', { class: 'choice' }, h('input', { type: 'radio', name: 'atype', value: k, checked: k === (mode === 'design' ? 'self' : 'self') }), h('span', null, h('b', null, label), h('br'),
      h('span', { class: 'muted small' }, k === 'self' ? 'Réalisé par l\'équipe qui conçoit l\'outil. Le rapport l\'indique clairement.' : k === 'cross' ? 'Réalisé par une autre équipe ou le jury, croisé avec l\'auto-évaluation.' : 'Réalisé par un tiers indépendant mandaté (institution, ONG, prestataire).')))));
  const loadRef = h('input', { id: 'loadref', type: 'checkbox', checked: true });

  const syncCase = () => {
    const c = f.case.value;
    if (c) {
      f.url.value = demoUrl(c);
      f.url.readOnly = true;
      f.name.value = c === 'haven' ? 'HAVEN (fictif, avant correction)' : 'SafeHer (fictif, après correction)';
      f.func.value = 'Informer, orienter et recevoir des demandes d\'aide (démonstration)';
      f.aud.value = 'Survivantes et survivants de VBG-FT, proches, témoins';
    } else { f.url.readOnly = false; }
    refBox.hidden = !c;
  };
  const refBox = h('div', { class: 'notice small' }, h('label', { class: 'choice' }, loadRef, h('span', null, 'Charger aussi l\'évaluation de référence de l\'équipe pour les critères humains (vous pourrez la modifier). Sans elle, vous évaluez vous-même les 30 critères.')));
  f.case.addEventListener('change', syncCase);

  const err = h('p', { class: 'notice danger', role: 'alert', hidden: true });
  refBox.classList.add('span2');
  auditType.classList.add('span2');
  err.classList.add('span2');
  const form = h('form', { class: 'panel form-grid', novalidate: true },
    field('case', 'Outil à auditer', f.case),
    refBox,
    field('url', 'Adresse URL', f.url, 'Analyse passive, limitée aux adresses autorisées. Sans adresse, les critères se remplissent manuellement.'),
    field('name', 'Nom du projet *', f.name),
    field('type', 'Type d\'outil', f.type),
    field('func', 'Fonction principale', f.func),
    field('aud', 'Public cible', f.aud),
    h('label', { class: 'choice span2' }, f.ai, h('span', null, 'L\'outil utilise de l\'intelligence artificielle (sinon, le critère E3 pourra être marqué N/A)')),
    auditType,
    h('p', { class: 'help span2' }, 'Ne saisissez aucune information réelle concernant une survivante. Ces champs décrivent un outil, pas une personne.'),
    err,
    h('div', { class: 'row span2' }, h('button', { type: 'submit', class: 'btn' }, mode === 'design' ? 'Commencer la grille de conception' : 'Lancer l\'analyse')));
  syncCase();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = clean(f.name.value, 120);
    if (!name) { err.hidden = false; err.textContent = 'Indiquez le nom du projet.'; f.name.focus(); return; }
    const url = clean(f.url.value, 2048);
    if (url && !/^https?:\/\//i.test(url)) { err.hidden = false; err.textContent = 'L\'adresse doit commencer par http:// ou https://'; f.url.focus(); return; }
    const a = createAudit({
      projectName: name, url, toolType: f.type.value, mainFunction: f.func.value, audience: f.aud.value,
      auditType: (form.querySelector('input[name="atype"]:checked') || {}).value, mode, caseId: f.case.value || null, usesAI: f.ai.checked
    });
    if (!f.ai.checked) setManual(a, 'E3', { note: 'na', naReason: 'L\'outil n\'utilise pas d\'intelligence artificielle (déclaré à la création de l\'audit).', proof: 'declared' });
    if (f.case.value && loadRef.checked) {
      applyReference(a, ctx.data.reference[f.case.value]);
    }
    persist(a);
    store.setCurrent(a.id);
    go(url ? `/audit/${a.id}/analyse?auto=1` : `/audit/${a.id}/criteres`);
  });

  return h('div', { class: 'stack' },
    h('h1', null, mode === 'design' ? 'Concevoir un outil sûr' : 'Analysez votre outil numérique'),
    h('p', { class: 'muted' }, mode === 'design'
      ? 'La grille NUKUN sert de liste de contrôle pendant la conception. Le rapport sera marqué « auto-évaluation, non certifiée ».'
      : 'Décrivez l\'outil, puis lancez l\'analyse automatique. Vous compléterez ensuite les critères et les scénarios.'),
    form);
}

// ---------------------------------------------------------------------------
// Module 0 : analyse automatique
// ---------------------------------------------------------------------------
const STATUS_ICON = { detected: ['ok', '✓'], not_detected: ['bad', '✗'], partial: ['part', '~'], unverifiable: ['unk', '?'] };

function findingTone(f) {
  // Pour les éléments « positifs », détecté = bien ; pour les risques, détecté = mal.
  const riskWhenDetected = ['cookies', 'cookies-consent', 'trackers', 'pixels', 'third-party', 'required-ident'];
  if (f.status === 'unverifiable') return STATUS_ICON.unverifiable;
  if (f.informative) return f.status === 'detected' ? ['info', 'i'] : ['unk', 'i'];
  if (f.id === 'forms') return ['info', 'i'];
  const good = riskWhenDetected.includes(f.id) ? f.status === 'not_detected' : f.status === 'detected';
  if (f.status === 'partial') return STATUS_ICON.partial;
  return good ? STATUS_ICON.detected : STATUS_ICON.not_detected;
}

export async function renderAnalysis(ctx, id, params) {
  const audit = requireAudit(id);
  const { data, t } = ctx;
  const status = h('div', { role: 'status', 'aria-live': 'polite' });
  const run = async (useSnapshot = false) => {
    status.textContent = 'Analyse en cours… (lecture passive des pages, aucun formulaire soumis)';
    let res;
    if (useSnapshot) {
      const snap = await loadSnapshot(audit.meta.caseId);
      res = snap ? { ok: true, result: snap } : { ok: false, message: 'Aucun instantané disponible pour cet outil.' };
    } else {
      res = await analyze(audit.meta.url);
    }
    if (!res.ok) {
      audit.analysisError = res.message;
      status.textContent = '';
      persist(audit);
      toast(res.message, 'warn');
      refresh();
      return;
    }
    delete audit.analysisError;
    applyAnalysis(audit, res.result);
    persist(audit);
    toast(useSnapshot ? 'Instantané chargé (plan de secours).' : 'Analyse terminée.', 'ok');
    refresh();
  };
  if (params.get('auto') === '1' && !audit.analysis && audit.meta.url) {
    history.replaceState(null, '', `#/audit/${audit.id}/analyse`);
    setTimeout(() => run(false), 0);
  }

  const a = audit.analysis;
  const body = [];
  if (!audit.meta.url) {
    body.push(h('div', { class: 'notice' }, 'Aucune adresse n\'a été saisie : mode manuel. Évaluez les critères observables (C1, C2, C3, C4, S1, S3, S5, A1, A4) vous-même dans la grille, avec une preuve 🧪 humaine.'));
  } else {
    body.push(h('div', { class: 'row no-print' },
      h('button', { type: 'button', class: 'btn', onclick: () => run(false) }, a ? 'Relancer l\'analyse' : 'Lancer l\'analyse'),
      audit.meta.caseId ? h('button', { type: 'button', class: 'btn secondary', onclick: () => run(true) }, 'Utiliser l\'instantané enregistré (secours)') : null,
      h('a', { class: 'btn secondary', href: audit.meta.url, target: '_blank', rel: 'noopener noreferrer' }, 'Ouvrir l\'outil'),
      status));
    if (audit.analysisError) body.push(h('div', { class: 'notice warn', role: 'alert' }, h('b', null, 'Analyse automatique indisponible. '), audit.analysisError, ' Vous pouvez continuer en mode manuel : les critères observables seront évalués par un test humain.'));
    if (!isLocalDemo(audit.meta.url) && !a) body.push(h('p', { class: 'help' }, 'Un site externe n\'est analysable que s\'il figure sur la liste autorisée du serveur NUKUN (variable NUKUN_ALLOWLIST).'));
  }

  if (a) {
    const groups = { detected: [], not_detected: [], partial: [], unverifiable: [] };
    for (const f of a.findings) (groups[f.status] || groups.unverifiable).push(f);
    body.push(h('section', { class: 'panel' },
      h('div', { class: 'row between' }, h('h2', null, 'Résultats de l\'analyse'), h('span', { class: 'badge navy' }, '🤖 Niveau de preuve : machine')),
      h('p', { class: 'small muted' }, `Mode : ${a.mode}${a.mode === 'instantané' ? ' (résultat enregistré à l\'avance — plan de secours)' : ''} · ${fmtDate(a.analyzedAt)} · ${a.pages.length} page(s) lue(s) : `, a.pages.map((p) => p.url.split('/').slice(-1)[0] || p.url).join(', ')),
      h('p', { class: 'small' }, `${groups.detected.length} élément(s) détecté(s) · ${groups.not_detected.length} non détecté(s) · ${groups.partial.length} partiel(s) · ${groups.unverifiable.length} impossible(s) à vérifier automatiquement`),
      a.findings.map((f) => {
        const [cls, sym] = findingTone(f);
        return h('div', { class: 'finding' },
          h('span', { class: ['ico', cls], 'aria-hidden': 'true' }, sym),
          h('div', null,
            h('div', { class: 'row between' }, h('b', null, f.label), h('span', { class: 'row' }, h('span', { class: 'badge outline' }, t.findingStatus[f.status] || f.status), f.criteria.length ? h('span', { class: 'badge teal' }, 'Critère ', f.criteria.join(', ')) : null)),
            h('p', { class: 'small' }, f.evidence),
            h('p', { class: 'small muted' }, h('b', null, 'Risque potentiel : '), f.risk)));
      })),
    h('section', { class: 'panel' },
      h('h2', null, 'Critères pré-remplis par la machine'),
      h('div', { class: 'table-wrap' }, h('table', { class: 'data' },
        h('thead', null, h('tr', null, h('th', null, 'Critère'), h('th', null, 'Note'), h('th', null, 'Constat'))),
        h('tbody', null, Object.entries(a.suggestions).map(([cid, s]) => h('tr', null,
          h('td', null, h('b', null, cid), ' ', data.criteria.find((c) => c.id === cid).name),
          h('td', null, `${s.note}/2`), h('td', { class: 'small' }, s.comment))))))),
    h('section', { class: 'panel' },
      h('h2', null, 'Ce que l\'analyse ne peut pas vérifier'),
      h('ul', null, a.unverifiable.map((u) => h('li', null, h('b', null, u.criteria.join(', ')), ' — ', u.why))),
      h('h3', null, 'Limites'),
      h('ul', { class: 'small' }, a.limits.map((l) => h('li', null, l))),
      h('p', { class: 'notice small' }, 'Une analyse passive ne garantit jamais la sécurité complète d\'un site.')));
  }
  return h('div', { class: 'stack' }, auditHeader(audit, data, 'analyse'), ...body, nextStep(audit, 'analyse'));
}

// ---------------------------------------------------------------------------
// Module 1 : grille des 30 critères
// ---------------------------------------------------------------------------
const filters = { pillar: 'all', crit: 'all', proof: 'all', status: 'all' };

export function renderCriteria(ctx, id) {
  const audit = requireAudit(id);
  const { data, t } = ctx;
  store.setCurrent(audit.id);
  const score = computeScore(audit.assessments, data.referential);

  const pillarTabs = h('div', { class: 'pillar-tabs', role: 'group', 'aria-label': 'Piliers' },
    h('button', { type: 'button', class: 'pillar-tab', 'aria-pressed': String(filters.pillar === 'all'), onclick: () => { filters.pillar = 'all'; refresh(); } }, h('b', null, 'Tous'), h('span', null, `${score.evaluated}/30 évalués`)),
    data.pillars.map((p) => {
      const ev = data.criteria.filter((c) => c.pillar === p.id && audit.assessments[c.id] && audit.assessments[c.id].note !== null && audit.assessments[c.id].note !== undefined).length;
      const ps = score.pillars.find((x) => x.id === p.id);
      return h('button', { type: 'button', class: 'pillar-tab', 'aria-pressed': String(filters.pillar === p.id), onclick: () => { filters.pillar = p.id; refresh(); } },
        h('b', null, `${p.id} · ${p.name}`), h('span', null, `${ev}/5 évalués · ${ps.percent === null ? 'N/A' : Math.round(ps.percent) + ' %'} · poids ${p.weight} %`),
        h('div', { class: 'progress' }, h('span', { style: { width: `${(ev / 5) * 100}%` } })));
    }));

  const chipGroup = (label, key, options) => h('div', null, h('span', { class: 'small muted' }, label, ' '),
    h('div', { class: 'chips', role: 'group', 'aria-label': label }, options.map(([v, l]) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(filters[key] === v), onclick: () => { filters[key] = v; refresh(); } }, l))));

  const list = data.criteria.filter((c) => {
    const a = audit.assessments[c.id];
    const eff = score.perCriterion[c.id];
    const proof = a && a.note !== null && a.note !== undefined && a.note !== 'na' ? a.proof : 'none';
    return (filters.pillar === 'all' || c.pillar === filters.pillar)
      && (filters.crit === 'all' || c.criticality === filters.crit)
      && (filters.proof === 'all' || proof === filters.proof)
      && (filters.status === 'all' || eff.status === filters.status);
  });

  return h('div', { class: 'stack' },
    auditHeader(audit, data, 'criteres'),
    h('div', { class: 'panel' },
      h('div', { class: 'row between' }, h('b', null, `Progression générale : ${score.evaluated}/30 critères évalués`), h('span', { class: 'small muted' }, `Score provisoire ${score.score}/100 · part prouvée ${score.provenShare} %`)),
      h('div', { class: 'progress', role: 'progressbar', 'aria-valuenow': score.verifiedPercent, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': 'Progression générale' }, h('span', { style: { width: `${score.verifiedPercent}%` } })),
      audit.reference ? h('p', { class: 'small notice' }, `Évaluation de référence chargée (${audit.reference.testedBy}, ${audit.reference.testedOn}). Les réponses marquées « Référence de l'équipe » peuvent être remplacées par vos propres tests.`) : null),
    pillarTabs,
    h('div', { class: 'panel stack' },
      chipGroup('Criticité :', 'crit', [['all', 'Toutes'], ['bloquant', 'Bloquants'], ['élevée', 'Élevée'], ['moyenne', 'Moyenne']]),
      chipGroup('Preuve :', 'proof', [['all', 'Toutes'], ['machine', t.proof.machine], ['human', t.proof.human], ['declared', t.proof.declared], ['none', 'Non évalué']]),
      chipGroup('Statut :', 'status', [['all', 'Tous'], ['nonconform', 'Non conformes'], ['partial', 'Partiels'], ['unverified', 'Non vérifiés'], ['conform', 'Conformes'], ['na', 'N/A']])),
    h('p', { class: 'small muted', role: 'status' }, `${list.length} critère(s) affiché(s)`),
    h('div', null, list.map((c) => criterionCard(ctx, audit, c, score))),
    nextStep(audit, 'criteres'));
}

function criterionCard(ctx, audit, c, score) {
  const { t } = ctx;
  const a = audit.assessments[c.id] || null;
  const m = audit.manual[c.id] || null;
  const eff = score.perCriterion[c.id];
  const st = { note: m ? m.note : null, proof: m ? m.proof : 'human', comment: m ? m.comment : '', naReason: m ? m.naReason : '', attachment: m ? m.attachment : null };

  const save = (patch) => {
    Object.assign(st, patch);
    if (st.note === null || st.note === undefined) setManual(audit, c.id, null);
    else setManual(audit, c.id, { ...st, source: 'manual' });
    persist(audit);
    refresh();
  };

  const noteSeg = h('div', { class: 'seg', role: 'group', 'aria-label': `Note du critère ${c.id}` },
    [[0, 'n0'], [1, 'n1'], [2, 'n2'], ['na', '']].map(([v, cls]) => h('button', { type: 'button', class: cls, 'aria-pressed': String(m && m.note === v), onclick: () => save({ note: m && m.note === v ? null : v }) }, t.notes[v])));
  const proofSeg = h('div', { class: 'seg', role: 'group', 'aria-label': `Niveau de preuve du critère ${c.id}` },
    ['human', 'declared'].map((p) => h('button', { type: 'button', 'aria-pressed': String(st.proof === p), title: t.proofLong[p], onclick: () => save({ proof: p }) }, t.proof[p])));
  const comment = h('textarea', { rows: 2, maxlength: 2000, 'aria-label': `Commentaire ou constat pour ${c.id}`, placeholder: 'Ce que vous avez observé, comment vous l\'avez testé (date, appareil)…' });
  comment.value = st.comment || '';
  comment.addEventListener('change', () => { if (m) save({ comment: comment.value }); else { st.comment = comment.value; toast('Choisissez d\'abord une note pour enregistrer le commentaire.', 'warn'); } });
  const naReason = h('input', { type: 'text', maxlength: 500, 'aria-label': `Justification N/A pour ${c.id}`, placeholder: 'Justification obligatoire du N/A' });
  naReason.value = st.naReason || '';
  naReason.addEventListener('change', () => save({ naReason: naReason.value }));
  const file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', 'aria-label': `Pièce justificative pour ${c.id}` });
  file.addEventListener('change', async () => {
    if (!m) { toast('Choisissez d\'abord une note.', 'warn'); file.value = ''; return; }
    try { save({ attachment: await readAttachment(file.files[0]) }); toast('Capture ajoutée (réduite, métadonnées supprimées).', 'ok'); }
    catch (e) { toast(e.message, 'err'); }
  });

  return h('article', { class: ['crit', c.blocking && 'blocking'], id: `crit-${c.id}` },
    h('header', null,
      h('span', { class: 'id' }, c.id), h('h3', null, c.name),
      c.blocking ? h('span', { class: 'badge red' }, 'Bloquant') : h('span', { class: 'badge outline' }, t.criticality[c.criticality]),
      statusBadge(eff.status), proofBadge(a && a.note !== null && a.note !== 'na' ? a.proof : 'none')),
    h('p', { class: 'q' }, c.question),
    h('details', null, h('summary', null, 'Explication et point de vue de la survivante'),
      h('p', null, c.explanation),
      h('p', { class: 'why' }, h('b', null, 'Pour Afi : '), c.survivorWhy),
      h('p', { class: 'small muted' }, h('b', null, 'Exemple de défaut : '), c.example),
      h('p', { class: 'small muted' }, `Poids : ${c.weight} (dans le pilier ${c.pillar}, ${ctx.data.pillars.find((p) => p.id === c.pillar).weight} %) · ${c.machine ? 'Observable en partie par l\'analyse automatique' : 'Demande un test humain ou une déclaration'}`)),
    h('p', { class: 'current' }, a
      ? [`Retenu : ${a.note === 'na' ? 'N/A' : a.note + '/2'}${eff.value !== a.note && a.note !== 'na' ? ` → ${eff.value} (${eff.reason})` : ''} · source : `, h('b', null, sourceText(a.source)), a.comment ? ` — ${a.comment}` : '']
      : 'Non évalué : compte 0 tant qu\'aucune preuve n\'est apportée.'),
    a && a.conflict ? h('p', { class: 'conflict', role: 'note' }, '⚠ ', a.conflict) : null,
    h('div', { class: 'controls' },
      h('div', null, h('span', { class: 'small muted' }, 'Votre note : '), noteSeg),
      h('div', null, h('span', { class: 'small muted' }, 'Niveau de preuve : '), proofSeg, h('p', { class: 'help' }, c.blocking ? 'Critère bloquant : une déclaration seule le laisse « non vérifié ».' : 'Une déclaration seule plafonne la note à 1. Le niveau « machine » est réservé à l\'analyse automatique.')),
      m && m.note === 'na' ? naReason : null,
      h('div', { class: 'span2' }, comment),
      h('div', { class: 'attach' }, h('span', { class: 'small muted' }, 'Pièce justificative facultative (capture sans donnée personnelle) : '), file, st.attachment ? [h('img', { src: st.attachment, alt: `Capture jointe au critère ${c.id}` }), h('button', { type: 'button', class: 'btn small danger', onclick: () => save({ attachment: null }) }, 'Retirer la capture')] : null),
      h('div', { class: 'row' },
        h('a', { class: 'btn small secondary', href: `#/kit/${c.correction}` }, 'Comment corriger ?'),
        m ? h('button', { type: 'button', class: 'btn small secondary', onclick: () => save({ note: null }) }, m.source === 'reference' ? 'Retirer la référence' : 'Effacer ma réponse') : null)));
}

function sourceText(src) {
  if (!src) return '—';
  if (src.startsWith('scenario:')) return 'Scénario ' + src.slice(9);
  return { manual: 'votre saisie', reference: 'référence de l\'équipe', analyzer: 'analyse automatique' }[src] || src;
}

// ---------------------------------------------------------------------------
// Module 2 : Test de l'agresseur intime
// ---------------------------------------------------------------------------
export function renderScenarios(ctx, id) {
  const audit = requireAudit(id);
  const { data } = ctx;
  store.setCurrent(audit.id);
  const done = data.scenarios.filter((s) => audit.scenarios[s.id] && audit.scenarios[s.id].verdict && audit.scenarios[s.id].verdict !== 'unverified').length;
  const refCase = audit.meta.caseId ? ctx.data.reference[audit.meta.caseId] : null;
  return h('div', { class: 'stack' },
    auditHeader(audit, data, 'scenarios'),
    h('div', { class: 'panel' },
      h('h2', null, 'Test de l\'agresseur intime'),
      h('p', null, 'Mettez-vous à la place de Kossi, qui a accès au téléphone d\'Afi. Ce ne sont pas des questions : exécutez réellement chaque action sur l\'outil audité, puis notez ce que vous constatez. Afi et Kossi sont des personnages fictifs.'),
      h('p', { class: 'small muted' }, `${done}/${data.scenarios.length} scénarios exécutés (T1 à T7 : mémoire NUKUN ; T8 et T9 : contexte béninois). Chaque verdict alimente les critères liés comme preuve 🧪 humaine (sans écraser vos propres réponses).`),
      refCase ? h('button', { type: 'button', class: 'btn small secondary', onclick: () => { applyReferenceScenarios(audit, refCase, data.scenarios); persist(audit); toast('Verdicts de référence chargés pour les scénarios non encore exécutés.', 'ok'); refresh(); } }, 'Charger les verdicts de référence de l\'équipe (scénarios non exécutés)') : null),
    h('h2', null, 'Scénarios du Test de l\'agresseur intime (T1 à T7)'),
    data.scenarios.filter((s) => s.origin !== 'contexte').map((s) => scenarioCard(ctx, audit, s)),
    h('h2', null, 'Scénarios complémentaires : contexte béninois (T8, T9)'),
    h('p', { class: 'muted small' }, 'Situations fréquentes au Bénin : un témoin qui veut signaler pour une autre personne, une victime qui ne lit pas le français. Ils utilisent les mêmes critères que la grille.'),
    data.scenarios.filter((s) => s.origin === 'contexte').map((s) => scenarioCard(ctx, audit, s)),
    nextStep(audit, 'scenarios'));
}

export function scenarioCard(ctx, audit, s, { compact = false } = {}) {
  const { t, data } = ctx;
  const r = audit.scenarios[s.id] || {};
  const notes = h('textarea', { rows: 2, maxlength: 2000, 'aria-label': `Résultat observé pour ${s.id}`, placeholder: 'Ce que vous avez constaté (appareil, navigateur, durée…)' });
  notes.value = r.notes || '';
  const set = (verdict) => { applyScenario(audit, s, verdict, notes.value); persist(audit); refresh(); };
  notes.addEventListener('change', () => { if (r.verdict) { applyScenario(audit, s, r.verdict, notes.value); persist(audit); } });
  const file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', 'aria-label': `Capture d'écran pour ${s.id}` });
  file.addEventListener('change', async () => {
    if (!r.verdict) { toast('Choisissez d\'abord un verdict.', 'warn'); file.value = ''; return; }
    try { applyScenario(audit, s, r.verdict, notes.value, await readAttachment(file.files[0])); persist(audit); toast('Capture ajoutée (réduite, métadonnées supprimées).', 'ok'); refresh(); }
    catch (e) { toast(e.message, 'err'); }
  });
  const crits = s.criteria.map((cid) => data.criteria.find((c) => c.id === cid));
  return h('article', { class: 'scenario', id: `scen-${s.id}` },
    h('div', { class: 'row between' }, h('h3', null, `${s.id} · ${s.title}`), h('span', { class: 'row' }, crits.map((c) => h('a', { class: 'badge teal', href: `#/audit/${audit.id}/criteres`, title: c.name }, c.id)))),
    h('p', { class: 'sit' }, s.situation),
    compact ? null : h('p', null, s.explanation),
    h('p', null, h('b', null, 'À faire : '), s.action),
    audit.meta.url ? h('p', null, h('a', { class: 'btn small secondary', href: audit.meta.url, target: '_blank', rel: 'noopener noreferrer' }, 'Ouvrir l\'outil audité dans un nouvel onglet')) : null,
    h('p', null, h('b', null, 'Question : '), s.question),
    h('div', { class: 'verdicts', role: 'group', 'aria-label': `Verdict ${s.id}` },
      ['exposed', 'partial', 'protected', 'unverified'].map((v) => h('button', { type: 'button', class: ['verdict', v], 'aria-pressed': String(r.verdict === v), onclick: () => set(v) },
        h('b', null, t.verdicts[v]), v !== 'unverified' ? h('small', null, s.guidance[v]) : h('small', null, 'Le test n\'a pas pu être réalisé.')))),
    notes,
    h('div', { class: 'attach' }, h('span', { class: 'small muted' }, 'Capture d\'écran comme preuve (facultatif, sans donnée personnelle) : '), file, r.attachment ? h('img', { src: r.attachment, alt: `Capture jointe au scénario ${s.id}` }) : null),
    r.verdict && r.verdict !== 'protected' && r.verdict !== 'unverified' ? h('p', { class: 'notice warn small' }, h('b', null, 'Recommandation : '), s.recommendation, ' ', h('a', { href: `#/kit/${s.correction}` }, 'Voir le correctif')) : null,
    r.verdict === 'protected' ? h('p', { class: 'small muted' }, 'Verdict valable dans le périmètre testé (appareil, navigateur, date) : ce n\'est pas une garantie absolue.') : null);
}
