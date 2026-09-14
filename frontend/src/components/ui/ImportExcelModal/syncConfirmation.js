// Construit le message de confirmation à partir de la réponse bulk-sync.
// Renvoie null pour les autres formes de réponse (ex. bulk-sync formations).
export const buildSyncConfirmation = (result) => {
  if (!result || typeof result !== 'object') return null
  if (!('created' in result) || !('unchanged' in result)) return null

  const created = Number(result.created ?? 0)
  const modified = Number(result.modified ?? result.updated ?? 0)
  const unchanged = Number(result.unchanged ?? 0)
  const hasChanges = created + modified > 0

  const counts = `${created} créé(s), ${modified} modifié(s), ${unchanged} inchangé(s)`
  const message = hasChanges
    ? `Synchronisation terminée : la base de données a été mise à jour (${counts}).`
    : `Aucun changement en base : ${unchanged} employé(s) importé(s) déjà à jour (${counts}).`

  return { hasChanges, created, modified, unchanged, message }
}
