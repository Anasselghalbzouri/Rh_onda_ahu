# Feature Specification: Documents employés (remplace Absences)

**Feature Branch**: `001-documents-employes`

**Created**: 2026-09-11

**Status**: Draft

**Input**: User description: "delet absence section and add section that contion document for chaque employer"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - RH consulte et gère les documents de tous les employés (Priority: P1)

Un utilisateur RH ouvre une nouvelle section "Documents employés" listant les documents de tous les employés, peut les rechercher, les filtrer, les ouvrir/télécharger, en ajouter, en supprimer, et voir immédiatement quels documents sont manquants, expirés ou à renouveler.

**Why this priority**: C'est la fonctionnalité centrale demandée : remplacer la gestion des absences par la gestion documentaire, qui est l'usage RH quotidien principal de cette section.

**Independent Test**: Peut être testé en se connectant en tant que RH, en ouvrant la section Documents employés, en recherchant un employé par nom ou matricule, et en confirmant que ses documents s'affichent avec leur statut.

**Acceptance Scenarios**:

1. **Given** un utilisateur RH connecté, **When** il ouvre la section Documents employés, **Then** il voit la liste des documents de tous les employés avec catégorie, statut et employé associé.
2. **Given** la liste des documents affichée, **When** le RH recherche par nom ou matricule ou filtre par catégorie/statut, **Then** seuls les documents correspondants s'affichent.
3. **Given** un document existant, **When** le RH clique pour l'ouvrir ou le télécharger, **Then** le fichier s'ouvre ou se télécharge correctement.
4. **Given** un document existant, **When** le RH demande sa suppression, **Then** une confirmation est demandée avant suppression effective.
5. **Given** un employé n'ayant pas fourni un document obligatoire, **When** le RH consulte la liste, **Then** ce document apparaît comme "Manquant".
6. **Given** un document dont la date d'expiration approche ou est dépassée, **When** le RH consulte la liste, **Then** ce document apparaît comme "À renouveler" ou "Expiré" selon le cas.

---

### User Story 2 - Un employé consulte ses propres documents (Priority: P2)

Un employé connecté accède à sa fiche personnelle ou son profil et y consulte uniquement ses propres documents, sans pouvoir voir ceux des autres employés.

**Why this priority**: Nécessaire pour que chaque employé garde un accès en libre-service à ses justificatifs, mais dépend de l'existence préalable de la fonctionnalité RH (P1).

**Independent Test**: Peut être testé en se connectant en tant qu'employé et en vérifiant que seule sa propre liste de documents est visible, avec un accès refusé si une tentative est faite pour consulter les documents d'un autre employé.

**Acceptance Scenarios**:

1. **Given** un employé connecté, **When** il ouvre son profil ou sa fiche personnelle, **Then** il voit uniquement la liste de ses propres documents.
2. **Given** un employé connecté, **When** il tente d'accéder aux documents d'un autre employé (par manipulation d'URL ou autre), **Then** l'accès est refusé.

---

### User Story 3 - Le DG consulte les documents en lecture seule (Priority: P3)

Un utilisateur DG consulte les documents des employés auxquels il a accès, en lecture seule, sans pouvoir en ajouter ni en supprimer.

**Why this priority**: Utile pour la supervision mais moins critique que la gestion opérationnelle RH et l'accès personnel employé.

**Independent Test**: Peut être testé en se connectant en tant que DG, en ouvrant la section documents, et en vérifiant l'absence des actions d'ajout et de suppression.

**Acceptance Scenarios**:

1. **Given** un utilisateur DG connecté, **When** il consulte la section documents, **Then** il peut voir et ouvrir/télécharger les documents mais ne voit aucune action d'ajout ou de suppression.

---

### Edge Cases

- Que se passe-t-il si un utilisateur RH ou DG tente d'accéder à la section Documents employés sans les droits requis ? L'accès doit être refusé.
- Que se passe-t-il si un employé n'a aucun document enregistré ? La liste doit afficher un état vide explicite, pas une erreur.
- Que se passe-t-il si un fichier téléversé dépasse la taille autorisée ou a un type non supporté ? Le téléversement doit être refusé avec un message clair, sans corrompre les données existantes.
- Que se passe-t-il si un document est supprimé alors qu'il est en cours de consultation/téléchargement par un autre utilisateur ? L'opération de suppression ne doit pas provoquer d'erreur système.
- Que se passe-t-il aux anciens liens ou raccourcis existants pointant vers la section Absences ? Ils doivent être retirés de la navigation ou rediriger proprement, sans lien mort visible pour l'utilisateur.
- Que se passe-t-il si les données d'absences existantes sont encore nécessaires pour d'autres besoins internes (paie, historique) pendant la transition ? Elles doivent rester accessibles en interne même si la section visible est retirée.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le système MUST retirer la section "Absences" de la navigation visible par les utilisateurs RH et Employé (menu et accès direct).
- **FR-002**: Le système MUST fournir une nouvelle section "Documents employés" accessible aux utilisateurs RH, listant les documents de tous les employés.
- **FR-003**: Le système MUST permettre à un utilisateur RH de rechercher les documents par nom ou matricule d'employé.
- **FR-004**: Le système MUST permettre à un utilisateur RH de filtrer les documents par catégorie et par statut.
- **FR-005**: Le système MUST permettre à un utilisateur RH d'ouvrir ou de télécharger un document existant.
- **FR-006**: Le système MUST permettre à un utilisateur RH d'ajouter un nouveau document pour un employé.
- **FR-007**: Le système MUST permettre à un utilisateur RH de supprimer un document, après confirmation explicite de l'action.
- **FR-008**: Le système MUST indiquer visuellement, pour chaque document ou type de document attendu, un statut parmi : Valide, À renouveler, Expiré, Manquant.
- **FR-009**: Le système MUST restreindre chaque employé à la consultation de ses propres documents uniquement, depuis son profil ou sa fiche personnelle.
- **FR-010**: Le système MUST empêcher un employé d'accéder, par quelque moyen que ce soit, aux documents d'un autre employé.
- **FR-011**: Le système MUST permettre à un utilisateur DG de consulter (voir, ouvrir, télécharger) les documents des employés auxquels il a accès, en lecture seule uniquement (sans ajout ni suppression).
- **FR-012**: Le système MUST valider le type et la taille des fichiers téléversés, et refuser les fichiers non conformes avec un message d'erreur explicite.
- **FR-013**: Le système MUST conserver une trace de l'utilisateur ayant ajouté ou supprimé un document.
- **FR-014**: Le système MUST conserver les données et l'historique liés aux absences en interne (sans suppression de données), même après le retrait de la section visible, le temps de valider qu'aucun autre usage interne n'en dépend.
- **FR-015**: Le système MUST classer chaque document dans une catégorie (par exemple : Contrat, CIN, Diplôme, Attestation de travail, Certificat médical, Décision administrative, Formation, Photo, Dossier administratif, Autre).

### Key Entities *(include if feature involves data)*

- **Document employé**: Représente un fichier associé à un employé (ex. contrat, CIN, diplôme). Attributs clés : catégorie, statut (Valide / À renouveler / Expiré / Manquant), date d'expiration éventuelle, caractère obligatoire ou non, utilisateur ayant ajouté/supprimé le document, employé associé.
- **Employé**: Personne pour laquelle des documents sont suivis ; possède un nom et un matricule permettant la recherche.
- **Catégorie de document**: Regroupement thématique des documents (ex. Contrat, CIN, Diplôme, etc.).
- **Statut de document**: État courant d'un document par rapport à sa validité (Valide, À renouveler, Expiré, Manquant).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un utilisateur RH peut retrouver et ouvrir le document d'un employé spécifique en moins de 30 secondes depuis la nouvelle section Documents employés.
- **SC-002**: 100% des entrées de menu et routes menant à la section Absences ne sont plus accessibles aux utilisateurs RH et Employé après la mise en production.
- **SC-003**: Un employé ne peut consulter aucun document appartenant à un autre employé, vérifié sur 100% des tentatives testées.
- **SC-004**: Un utilisateur RH peut identifier en un coup d'œil, sans action supplémentaire, les documents manquants ou expirés pour un employé donné.
- **SC-005**: Aucune donnée d'absence existante n'est perdue à la suite du retrait de la section visible.

## Assumptions

- La liste des catégories de documents proposées (Contrat, CIN, Diplôme, Attestation de travail, Certificat médical, Décision administrative, Formation, Photo, Dossier administratif, Autre) et des statuts (Valide, À renouveler, Expiré, Manquant) reprend les catégories déjà envisagées pour ce projet et sert de valeur par défaut.
- Le retrait de la section "Absences" concerne uniquement l'interface visible (navigation et accès direct) ; les données, modèles et tables backend liés aux absences sont conservés temporairement tant qu'une vérification des dépendances (migrations, synchronisations Excel, historique paie) n'a pas confirmé qu'ils peuvent être supprimés définitivement.
- Les rôles existants (RH, Employé, DG) et leurs permissions générales sont réutilisés tels quels ; seule leur application à la nouvelle section documents est définie ici.
- La fonctionnalité de gestion documentaire partielle déjà présente dans la fiche employé constitue la base à compléter plutôt qu'à reconstruire entièrement.
- Les limites de taille et types de fichiers autorisés suivent les pratiques standards déjà en usage pour les téléversements de documents RH (formats courants de type image/PDF, taille raisonnable pour ce type de document).
