<?php

namespace App\Support;

/**
 * Listes de référence partagées pour la gestion des documents employés.
 * Valeurs issues de specs/001-documents-employes/data-model.md.
 */
final class DocumentsEmployesReference
{
    public const CATEGORIES = [
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
    ];

    public const STATUTS = [
        'valide',
        'a_renouveler',
        'expire',
        'manquant',
    ];

    /** Délai (en jours) avant expiration à partir duquel un document passe « à renouveler ». */
    public const DELAI_RENOUVELLEMENT_JOURS = 30;
}
