/**
 * NUKUN — Textes d'interface en français.
 * Architecture prête pour la traduction : ajouter un fichier src/i18n/<langue>.js
 * avec les mêmes clés, et des fichiers src/data/<langue>/ pour le référentiel.
 * AUCUNE traduction en langue nationale n'est inventée : elles devront être
 * réalisées et validées par des locuteurs (fon, yoruba, bariba, dendi…).
 */
export default {
  lang: 'fr',
  proof: { machine: '🤖 Machine', human: '🧪 Humain', declared: '💬 Déclaration', none: 'Non évalué' },
  proofLong: {
    machine: 'Observé automatiquement par l\'analyse de l\'adresse',
    human: 'Vérifié par un test humain documenté',
    declared: 'Information déclarée par l\'éditeur, sans preuve (plafonnée à « partiel »)'
  },
  status: { conform: 'Conforme', partial: 'Partiel', nonconform: 'Non conforme', unverified: 'Non vérifié', na: 'N/A' },
  statusTone: { conform: 'green', partial: 'orange', nonconform: 'red', unverified: '', na: 'outline' },
  notes: { 0: '0 · Absent', 1: '1 · Partiel', 2: '2 · Conforme', na: 'N/A' },
  verdicts: {
    exposed: 'Afi est exposée',
    partial: 'Risque partiellement maîtrisé',
    protected: 'Afi est protégée dans le périmètre testé',
    unverified: 'Non vérifié'
  },
  lights: { red: 'Rouge', orange: 'Orange', green: 'Vert' },
  lightMeaning: {
    red: 'Non déployable dans l\'état évalué.',
    orange: 'Corrections prioritaires nécessaires.',
    green: 'Niveau favorable pour envisager un déploiement sous contrôle humain.'
  },
  findingStatus: { detected: 'Détecté', not_detected: 'Non détecté', partial: 'Partiel', unverifiable: 'Impossible à vérifier automatiquement' },
  planStates: { todo: 'À faire', doing: 'En cours', done: 'Fait' },
  criticality: { bloquant: 'Bloquant', 'élevée': 'Criticité élevée', moyenne: 'Criticité moyenne' },
  disclaimer: 'Le score NUKUN est un indicateur des critères évalués et des preuves disponibles. Il ne constitue ni une certification, ni une garantie de sécurité, ni un substitut à un audit professionnel.',
  centralMessage: 'Un outil numérique destiné à protéger une survivante ne doit jamais devenir une nouvelle source de danger. NUKUN permet de voir les risques, de les corriger et de vérifier les améliorations.'
};
