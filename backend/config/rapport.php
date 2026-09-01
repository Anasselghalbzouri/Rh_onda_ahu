<?php

return [
    // Chemin absolu vers le classeur maître "PS09_Rapport d'activité Trimestriel.xlsx".
    // Ce fichier contient des données réelles et n'est jamais versionné (voir .gitignore).
    // Par défaut : à la racine du dépôt, à côté de backend/ et frontend/.
    'ps09_template_path' => env(
        'RAPPORT_PS09_TEMPLATE_PATH',
        base_path("../PS09_Rapport d'activité  Tremistriel _ 2025.xlsx")
    ),
];
