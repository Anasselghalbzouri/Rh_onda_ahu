// Listes de référence partagées pour les documents employés.
// Miroir de backend/app/Support/DocumentsEmployesReference.php.

export const DOCUMENT_CATEGORIES = [
  'Contrat',
  'CIN',
  'Diplôme',
  'Attestation de travail',
  'Certificat médical',
  'Décision administrative',
  'Formation',
  'Photo',
  'Dossier administratif',
  'Autre',
]

export const DOCUMENT_STATUTS = ['valide', 'a_renouveler', 'expire', 'manquant']

export const DOCUMENT_STATUT_LABELS = {
  valide: 'Valide',
  a_renouveler: 'À renouveler',
  expire: 'Expiré',
  manquant: 'Manquant',
}

// Variants du composant ui/Badge associés à chaque statut.
export const DOCUMENT_STATUT_VARIANTS = {
  valide: 'success',
  a_renouveler: 'warning',
  expire: 'error',
  manquant: 'info',
}
