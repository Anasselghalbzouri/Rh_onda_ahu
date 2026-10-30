import api from '../api'

/**
 * Télécharge une pièce jointe via la route protégée (pas d'URL publique).
 * Le fichier est récupéré en flux authentifié puis enregistré côté navigateur.
 */
export async function telechargerFichier(route, nom) {
  const { data } = await api.get(route, { responseType: 'blob' })
  const url = URL.createObjectURL(data)
  const lien = document.createElement('a')
  lien.href = url
  lien.download = nom ?? 'document'
  document.body.appendChild(lien)
  lien.click()
  lien.remove()
  URL.revokeObjectURL(url)
}

export async function telechargerPieceJointe(piece) {
  if (!piece?.id) return
  await telechargerFichier(`/pieces-jointes/${piece.id}/download`, piece.nom_original)
}
