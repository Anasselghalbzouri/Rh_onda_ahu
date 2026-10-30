// Calculs partagés entre le formulaire et l'aperçu du rapport PS09 (spec 005).
export const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

export const ratio = (n, d) => (n == null || !d ? null : n / d)
export const pct = (r) => (r == null ? '—' : `${Math.round(r * 100)} %`)

// Libellé du fichier PS09 : « 2. Recrutement en Mars 2026 pour le poste de Pompier ».
export const libelleRecrutement = (r, annee) => {
  const mois = MOIS[r.mois - 1]
  return `${r.nombre}. Recrutement en ${mois.charAt(0).toUpperCase()}${mois.slice(1)} ${annee} pour le poste de ${r.fonction}`
}

// Taux de réalisation des engagements siège : mois avec un prévu uniquement.
export const tauxEngagements = (engagements = []) => {
  const avecPrevu = engagements.filter((m) => m?.prevu > 0)
  return ratio(
    avecPrevu.reduce((s, m) => s + (m.realise ?? 0), 0),
    avecPrevu.reduce((s, m) => s + m.prevu, 0),
  )
}
