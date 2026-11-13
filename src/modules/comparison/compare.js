/**
 * NUKUN — Comparaison de deux rapports (module pur). Fondée uniquement sur les
 * résultats du moteur d'audit : aucune valeur n'est saisie à la main.
 */
const RANK = { na: -1, unverified: 0, nonconform: 0, partial: 1, conform: 2 };

export function compareReports(before, after) {
  const pillars = before.score.pillars.map((p, i) => {
    const a = after.score.pillars[i];
    return { id: p.id, name: p.name, before: p.percent, after: a.percent, delta: p.percent === null || a.percent === null ? null : Math.round(a.percent - p.percent) };
  });
  const fixed = [];
  const degraded = [];
  before.criteria.forEach((b, i) => {
    const a = after.criteria[i];
    if (b.status === a.status || b.status === 'na' || a.status === 'na') return;
    const row = { id: b.id, name: b.name, before: b.status, after: a.status };
    if (RANK[a.status] > RANK[b.status]) fixed.push(row);
    else if (RANK[a.status] < RANK[b.status]) degraded.push(row);
  });
  const remaining = after.criteria.filter((c) => c.status !== 'conform' && c.status !== 'na').map((c) => ({ id: c.id, name: c.name, status: c.status, comment: c.comment }));
  const scenarios = before.scenarios.map((s, i) => ({ id: s.id, title: s.title, before: s.verdict, after: after.scenarios[i].verdict }));
  return { scoreBefore: before.score.score, scoreAfter: after.score.score, delta: after.score.score - before.score.score, pillars, fixed, degraded, remaining, scenarios };
}
