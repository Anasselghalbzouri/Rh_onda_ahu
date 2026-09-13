# Feature Specification: Refonte du Rapport d'Activité PS09 et Export des Données Employés

**Feature Branch**: `002-rapport-activite-employes`

**Created**: 2026-09-12

**Status**: Draft

**Input**: User description: "we gone change Rapport d'activité PS09 and add feauter that can generate raport that all donner de chaque emploiyeur sans conger malader ect ..."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Générer un export complet des données de chaque employé (Priority: P1)

En tant que responsable RH, je veux générer un rapport listant toutes les informations administratives et professionnelles de chaque employé (identité, poste, catégorie, échelle/échelon, service, dates de carrière, mutations, retraite/départ...), à l'exclusion des données de congés, maladies et absences, afin d'obtenir une vue d'ensemble du personnel sans avoir à croiser plusieurs écrans ni exposer des informations médicales/absences sensibles dans ce document.

**Why this priority**: C'est la nouvelle capacité demandée explicitement par l'utilisateur et qui n'existe pas encore dans la plateforme ; elle apporte une valeur immédiate (vue consolidée du personnel) indépendamment de la refonte du PS09.

**Independent Test**: Peut être testé seul en se connectant en tant que RH, en lançant la génération du rapport « données employés » et en vérifiant que le fichier produit contient une ligne par employé avec les champs administratifs attendus, et aucune colonne relative aux congés/maladies/absences.

**Acceptance Scenarios**:

1. **Given** au moins un employé actif existe dans la base, **When** le RH déclenche la génération du rapport « données employés », **Then** le système produit un fichier téléchargeable contenant une ligne par employé avec ses informations administratives (identité, poste, service, catégorie, dates de carrière) et sans aucune colonne liée aux congés, maladies ou absences.
2. **Given** un filtre optionnel (ex. service, statut) est appliqué, **When** le RH lance la génération, **Then** le rapport ne contient que les employés correspondant au filtre.
3. **Given** aucun employé ne correspond aux critères choisis, **When** le RH lance la génération, **Then** le système affiche un message clair indiquant qu'aucune donnée n'est disponible plutôt que de produire un fichier vide sans explication.

---

### User Story 2 - Mettre à jour le contenu calculé du Rapport d'Activité PS09 (Priority: P2)

En tant que responsable RH, je veux que le Rapport d'Activité Trimestriel PS09 reflète les indicateurs mis à jour attendus par la direction (au-delà des indicateurs Formation et Effectif déjà couverts), afin que le document trimestriel exporté reste conforme aux besoins de reporting sans ressaisie manuelle supplémentaire.

**Why this priority**: Cette demande porte sur un rapport existant déjà fonctionnel (formations + effectif) ; elle est importante mais secondaire à la nouvelle fonctionnalité d'export employés tant que le périmètre exact du changement n'est pas confirmé.

**Independent Test**: Peut être testé seul en générant un export PS09 pour un trimestre donné et en vérifiant que les nouvelles cellules/indicateurs demandés sont correctement remplis, sans régression sur les indicateurs Formation/Effectif déjà calculés et sans altérer les graphiques natifs du classeur.

**Acceptance Scenarios**:

1. **Given** un trimestre et une année valides, **When** le RH exporte le PS09, **Then** les indicateurs déjà pris en charge (formations planifiées/réalisées/évaluées/efficaces, effectifs intégrés/départs/mutations) restent corrects.
2. **Given** les nouveaux indicateurs demandés pour le PS09, **When** le RH exporte le PS09 pour un trimestre donné, **Then** les cellules correspondantes du classeur sont remplies avec les valeurs calculées à partir des données de la plateforme, sans modifier les graphiques existants.

---

### User Story 3 - Exporter le rapport employés dans un format exploitable hors-ligne (Priority: P3)

En tant que responsable RH, je veux pouvoir télécharger le rapport « données employés » dans un format bureautique standard, afin de pouvoir l'archiver, l'imprimer ou le transmettre à la direction sans dépendre de la plateforme.

**Why this priority**: Complète l'expérience de l'export mais n'est pas bloquant pour la valeur principale (consultation des données) si un affichage à l'écran existe déjà en attendant.

**Independent Test**: Peut être testé seul en déclenchant le téléchargement du rapport généré en User Story 1 et en vérifiant que le fichier s'ouvre correctement dans un tableur standard avec les mêmes données que celles affichées à l'écran.

**Acceptance Scenarios**:

1. **Given** un rapport « données employés » généré, **When** le RH clique sur « Télécharger », **Then** un fichier au format tableur (Excel) est téléchargé avec un nom explicite incluant la date de génération.

---

### Edge Cases

- Que se passe-t-il si un employé a un dossier incomplet (champ obligatoire manquant, ex. service non renseigné) ? Le rapport doit afficher une valeur vide/« non renseigné » pour ce champ plutôt que d'échouer la génération.
- Comment le système gère-t-il un très grand nombre d'employés (ex. plusieurs milliers) lors de la génération du rapport, pour éviter un délai d'attente excessif ?
- Que se passe-t-il si le modèle PS09 (fichier Excel maître) est absent ou corrompu au moment de l'export ? Le système doit renvoyer un message d'erreur explicite (comportement déjà en place pour l'export PS09 actuel, à conserver).
- Un employé en cours de départ (retraite/départ volontaire/mutation) doit-il apparaître dans le rapport « données employés » ? Oui, avec son statut affiché, car ces informations relèvent de la carrière administrative et non des congés/maladies.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le système DOIT permettre à un utilisateur RH authentifié de générer un rapport listant, pour chaque employé, ses informations d'identité et administratives (matricule, nom, prénom, sexe, date de naissance, date d'embauche, catégorie, échelle, échelon, entité, fonction, qualification, service, affectation, statut de mutation/retraite/départ volontaire et dates associées).
- **FR-002**: Le système NE DOIT PAS inclure dans ce rapport les données issues des congés, maladies/absences ou demandes de congé de l'employé.
- **FR-003**: Le système DOIT permettre de filtrer le rapport « données employés » par au moins un critère (ex. service et/ou statut actif/inactif) avant génération.
- **FR-004**: Le système DOIT permettre de télécharger le rapport généré dans un format tableur (Excel), avec un nom de fichier incluant la date de génération.
- **FR-005**: Le système DOIT afficher un message explicite lorsque aucun employé ne correspond aux critères de filtrage sélectionnés.
- **FR-006**: Le système DOIT continuer à permettre l'export du Rapport d'Activité PS09 existant (formations, effectifs) sans régression fonctionnelle.
- **FR-007**: Le système DOIT consolider et fiabiliser le calcul des indicateurs PS09 déjà automatisés (Formation, Effectif) pour le trimestre/année sélectionné ; aucun nouvel indicateur automatisé n'est ajouté dans le périmètre de cette fonctionnalité. Les indicateurs sans source de données dans la plateforme (accidents du travail, polyvalence, réclamations, actions d'amélioration, stagiaires...) restent saisis manuellement dans le fichier Excel, comme aujourd'hui.
- **FR-008**: Le système DOIT réserver l'accès à la génération des deux rapports (PS09 et données employés) aux utilisateurs RH authentifiés, de la même manière que les rapports existants.
- **FR-009**: Le système DOIT préserver l'intégrité des graphiques natifs et de la mise en forme du classeur PS09 lors de toute modification de son contenu calculé.

### Key Entities

- **Employé**: Représente une personne employée par l'organisation ; attributs administratifs pertinents pour ce rapport : identité, poste, service, catégorie/échelle/échelon, dates de carrière (embauche, affectation, mutation, retraite, départ volontaire), statut. Exclut explicitement le solde de congés, les congés pris et les absences pour maladie.
- **Rapport d'Activité PS09**: Document trimestriel existant regroupant des indicateurs RH (formation, effectif, et d'autres indicateurs saisis manuellement) ; ce document est mis à jour par génération automatique à partir des données de la plateforme pour les indicateurs disponibles.
- **Rapport Données Employés** (nouveau): Export consolidé listant les informations administratives de l'ensemble (ou d'un sous-ensemble filtré) des employés, à un instant donné.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un responsable RH peut générer et télécharger le rapport « données employés » pour l'ensemble du personnel en moins de 30 secondes.
- **SC-002**: 100 % des colonnes du rapport « données employés » correspondent à des informations administratives/de carrière ; aucune colonne relative aux congés, maladies ou absences n'apparaît.
- **SC-003**: Le Rapport d'Activité PS09 exporté après la mise à jour continue de produire des valeurs correctes à 100 % pour les indicateurs Formation et Effectif déjà pris en charge (aucune régression).
- **SC-004**: Les responsables RH n'ont plus besoin de consulter manuellement plusieurs écrans pour obtenir une vue consolidée du personnel, réduisant le temps de préparation d'un état du personnel d'au moins 50 % par rapport au processus manuel actuel.

## Assumptions

- Le rapport « données employés » couvre tous les employés présents dans la table `Employe`, y compris ceux en mutation/retraite/départ volontaire (avec leur statut visible), sauf si un filtre explicite est appliqué.
- Le format d'export du nouveau rapport « données employés » est un fichier Excel (.xlsx) généré à la demande, cohérent avec le format déjà utilisé pour le PS09, en plus d'une consultation à l'écran dans l'interface avant téléchargement.
- Concernant le PS09, le périmètre de cette fonctionnalité se limite à consolider les indicateurs déjà automatisés (Formation, Effectif) — confirmé avec l'utilisateur. Aucun nouvel indicateur automatisé n'est ajouté ; les indicateurs sans table dédiée (accidents du travail, polyvalence, réclamations, actions d'amélioration, stagiaires) restent saisis manuellement comme aujourd'hui.
- Seuls les utilisateurs RH authentifiés (rôle unique existant `auth:rh`) ont accès à ces deux rapports ; aucune notion de rôle supplémentaire n'est introduite.
- Les performances du système actuel (volume d'employés géré aujourd'hui par la plateforme) permettent une génération synchrone du rapport sans nécessiter de traitement asynchrone/file d'attente.
