# Feature Specification: Qualité et Complétude du Référentiel

**Feature Branch**: `003-qualite-completude-referentiel`

**Created**: 2026-09-13

**Status**: Draft

**Input**: User description: "Qualité et complétude du référentiel — Un écran de contrôle qui mesure, agent par agent, ce qui manque au dossier, et un jeu de règles qui empêche une donnée incomplète d'entrer dans la base. Aujourd'hui plusieurs agents sont enregistrés sans fonction, sans service et sans date d'embauche, et la fiche affiche « Dossier complet 0 % » même quand le profil est renseigné. Écrans: Liste des dossiers incomplets groupée par service avec le nom du champ manquant en clair; Taux de complétude par service et par catégorie d'agent; Rapport d'import Excel (lignes acceptées, rejetées, motif du rejet). Données: regle_completude (champ visé, catégorie d'agent, caractère obligatoire, poids); sur l'employé: taux calculé, champs manquants, date du dernier calcul. Règles: pour un agent actif, fonction/service/entité/date d'embauche/catégorie/échelle/échelon/date de naissance sont obligatoires; l'import rejette la ligne incomplète et l'explique au lieu d'insérer un tiret; recalcul à chaque enregistrement de fiche et une fois par nuit pour l'ensemble. Alimente le compteur « Dossier complet » de la fiche agent, la fiabilité de l'effectif par service et les statistiques du tableau de bord."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Voir et corriger les dossiers incomplets (Priority: P1)

En tant que responsable RH, je veux consulter une liste des agents dont le dossier est incomplet, regroupée par service, avec le nom exact du (ou des) champ(s) manquant(s) pour chaque agent, afin de savoir précisément quoi corriger sans devoir ouvrir chaque fiche une par une.

**Why this priority**: C'est le problème concret signalé (« Dossier complet 0 % » alors que le profil semble renseigné) et la valeur la plus immédiate : sans cet écran, personne ne sait quoi corriger ni où regarder.

**Independent Test**: Se connecter en tant que RH, ouvrir l'écran « Dossiers incomplets », vérifier que les agents actifs ayant au moins un champ obligatoire manquant apparaissent group par service avec la liste en clair des champs manquants (ex. « Fonction manquante », « Date d'embauche manquante »), et que les agents dont le dossier est complet n'apparaissent pas dans la liste.

**Acceptance Scenarios**:

1. **Given** un agent actif sans fonction et sans date d'embauche, **When** le RH ouvre l'écran des dossiers incomplets, **Then** l'agent apparaît sous son service avec les libellés « Fonction manquante » et « Date d'embauche manquante ».
2. **Given** un agent actif dont tous les champs obligatoires sont renseignés, **When** le RH ouvre l'écran, **Then** cet agent n'apparaît pas dans la liste des dossiers incomplets.
3. **Given** un agent dont le champ « service » est lui-même manquant, **When** le RH ouvre l'écran, **Then** cet agent est visible dans un regroupement « Service non défini » plutôt que d'être silencieusement omis.
4. **Given** l'écran des dossiers incomplets est ouvert, **When** le RH corrige un champ manquant sur la fiche d'un agent puis enregistre, **Then** cet agent disparaît de la liste des dossiers incomplets dès le prochain chargement de l'écran (le taux étant recalculé à l'enregistrement).

---

### User Story 2 - Suivre le taux de complétude par service et par catégorie (Priority: P2)

En tant que responsable RH ou direction, je veux voir le taux de complétude des dossiers agrégé par service et par catégorie d'agent, afin d'identifier les services ou catégories où la fiabilité des données est la plus faible et de prioriser les actions de correction.

**Why this priority**: Une fois les dossiers individuels visibles (US1), la vue agrégée permet un pilotage à l'échelle de l'organisation et alimente le tableau de bord ; elle dépend des règles de complétude déjà en place mais ajoute une valeur de pilotage distincte.

**Independent Test**: Avec un jeu d'agents ayant des taux de complétude variés répartis sur au moins deux services et deux catégories, ouvrir l'écran « Taux de complétude » et vérifier que chaque service et chaque catégorie affiche un pourcentage cohérent avec le nombre d'agents complets/incomplets qui lui sont associés.

**Acceptance Scenarios**:

1. **Given** un service avec 10 agents actifs dont 6 ont un dossier complet, **When** le RH consulte l'écran de taux de complétude, **Then** le taux affiché pour ce service reflète la proportion pondérée définie par les règles de complétude (et non un simple pourcentage brut si des poids différents s'appliquent).
2. **Given** deux catégories d'agents différentes (ex. Cadre et Exécution) avec des règles de champs obligatoires différentes, **When** le RH consulte l'écran, **Then** chaque catégorie est évaluée selon ses propres règles de complétude et affiche un taux distinct.
3. **Given** un service ne comportant aucun agent actif, **When** le RH consulte l'écran, **Then** ce service est affiché avec une indication explicite (ex. « Aucun agent actif ») plutôt qu'un taux de 0 % trompeur.

---

### User Story 3 - Empêcher l'entrée de données incomplètes via l'import Excel (Priority: P3)

En tant que responsable RH qui importe un fichier Excel d'effectif, je veux que les lignes incomplètes soient rejetées avec un motif clair au lieu d'être insérées avec des tirets ou des valeurs vides, et je veux un rapport d'import indiquant les lignes acceptées, les lignes rejetées et pourquoi, afin de garantir que seules des données fiables entrent dans la base.

**Why this priority**: Cette règle empêche la ré-apparition du problème à la source (nouveaux imports), mais elle a le plus de valeur une fois que les règles de complétude et leur affichage (US1, US2) existent déjà pour définir ce qu'est une ligne « complète ».

**Independent Test**: Préparer un fichier Excel contenant une ligne valide pour un agent actif et une ligne pour un agent actif sans fonction ni service ; lancer l'import ; vérifier que la ligne valide crée/met à jour l'agent, que la ligne invalide est rejetée sans créer ni modifier d'enregistrement, et que le rapport d'import liste cette ligne comme rejetée avec le motif « Fonction manquante, Service manquant ».

**Acceptance Scenarios**:

1. **Given** un fichier Excel avec une ligne où le champ « date d'embauche » est vide pour un agent actif, **When** l'import est lancé, **Then** cette ligne est rejetée, aucun enregistrement n'est créé ou modifié pour cette ligne, et le rapport d'import affiche le motif « Date d'embauche manquante ».
2. **Given** un fichier Excel avec une ligne complète pour un agent actif, **When** l'import est lancé, **Then** l'agent est créé ou mis à jour normalement et la ligne apparaît comme acceptée dans le rapport.
3. **Given** une ligne d'import concerne un agent existant déjà complet en base, et que la ligne importée est incomplète, **When** l'import est lancé, **Then** la ligne est rejetée et les données déjà présentes en base pour cet agent ne sont pas écrasées par des valeurs vides.
4. **Given** un import contenant 50 lignes dont 5 rejetées, **When** l'import se termine, **Then** le rapport affiche le total de lignes traitées, le nombre de lignes acceptées, le nombre de lignes rejetées et, pour chaque ligne rejetée, le numéro de ligne et le motif détaillé.

---

### Edge Cases

- Un agent n'a pas le statut « actif » (retraité, parti, muté) : les règles de champs obligatoires strictes ne s'appliquent pas de la même façon ; le système doit tout de même produire un taux de complétude cohérent (ou l'exclure explicitement des statistiques « agents actifs ») sans jamais afficher un taux de 0 % non justifié.
- Un champ obligatoire existe en base mais avec une valeur techniquement non vide mais invalide (ex. chaîne composée uniquement d'espaces, ou un tiret `-` inséré par un ancien import) : ce champ doit être traité comme manquant par le calcul de complétude.
- Une nouvelle règle de complétude est ajoutée ou modifiée (nouveau champ obligatoire, nouveau poids) : tous les taux existants doivent refléter la nouvelle règle après le prochain recalcul (à l'enregistrement ou lors du recalcul nocturne), sans nécessiter une action manuelle par agent.
- Le recalcul nocturne échoue partiellement (ex. interruption) : les agents déjà traités doivent conserver leur nouveau taux, et l'exécution suivante doit pouvoir reprendre sans dupliquer le travail ni laisser des agents avec une date de dernier calcul obsolète de manière permanente.
- Un service est supprimé ou renommé alors que des agents lui sont rattachés : les écrans de taux par service doivent rester cohérents.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le système DOIT permettre de définir des règles de complétude (`regle_completude`), chacune associée à un champ cible de la fiche agent, à une ou plusieurs catégories d'agent concernées, à un caractère obligatoire (oui/non), et à un poids utilisé dans le calcul du taux de complétude.
- **FR-002**: Pour tout agent actif, le système DOIT considérer comme obligatoires au minimum les champs suivants : fonction, service, entité, date d'embauche, catégorie, échelle, échelon et date de naissance.
- **FR-003**: Le système DOIT calculer, pour chaque agent, un taux de complétude basé sur les règles applicables à sa catégorie, en tenant compte du poids de chaque champ obligatoire manquant.
- **FR-004**: Le système DOIT stocker, sur chaque agent, le taux de complétude calculé, la liste des champs manquants (en clair) et la date du dernier calcul.
- **FR-005**: Le système DOIT recalculer le taux de complétude et la liste des champs manquants d'un agent immédiatement après chaque enregistrement (création ou modification) de sa fiche.
- **FR-006**: Le système DOIT recalculer le taux de complétude et la liste des champs manquants de l'ensemble des agents une fois par nuit, de façon automatique et sans intervention manuelle.
- **FR-007**: Le système DOIT fournir un écran listant les dossiers incomplets, groupés par service, affichant pour chaque agent concerné le nom en clair de chaque champ obligatoire manquant.
- **FR-008**: Le système DOIT fournir un écran affichant le taux de complétude agrégé par service et par catégorie d'agent.
- **FR-009**: Un champ considéré comme vide (null, chaîne vide, chaîne composée uniquement d'espaces, ou valeur de type tiret/placeholder) DOIT être traité comme manquant par le calcul de complétude, quel que soit son historique de saisie.
- **FR-010**: Lors d'un import Excel, le système DOIT évaluer chaque ligne par rapport aux règles de complétude obligatoires applicables à la catégorie de l'agent concerné, avant toute écriture en base.
- **FR-011**: Lors d'un import Excel, le système DOIT rejeter toute ligne incomplète (au regard des champs obligatoires pour un agent actif) sans créer ni modifier l'enregistrement de l'agent correspondant, et DOIT enregistrer le motif du rejet en listant explicitement chaque champ obligatoire manquant.
- **FR-012**: Lors d'un import Excel, le système NE DOIT PAS insérer de valeur de substitution (tiret, chaîne vide ou équivalent) à la place d'un champ obligatoire manquant : soit la donnée réelle est fournie, soit la ligne est rejetée.
- **FR-013**: Le système DOIT produire, pour chaque import Excel, un rapport indiquant le nombre total de lignes traitées, le nombre de lignes acceptées, le nombre de lignes rejetées, et pour chaque ligne rejetée son numéro et son motif détaillé.
- **FR-014**: Le rejet d'une ligne d'import concernant un agent déjà existant en base NE DOIT PAS écraser les valeurs déjà enregistrées pour cet agent par des valeurs vides ou manquantes.
- **FR-015**: Le compteur « Dossier complet » affiché sur la fiche d'un agent DOIT refléter le taux de complétude stocké et recalculé selon FR-003 à FR-006, et ne DOIT plus afficher 0 % lorsque les champs obligatoires sont effectivement renseignés.
- **FR-016**: Le taux de complétude, sa ventilation par service/catégorie, et l'indicateur de fiabilité de l'effectif DOIVENT être exposés comme source de données pour les statistiques du tableau de bord existant.
- **FR-017**: Le système DOIT permettre de distinguer, dans les écrans de complétude, les agents non actifs (retraités, partis, mutés) des agents actifs, afin de ne pas fausser les taux de fiabilité de l'effectif « actif ».

### Key Entities *(include if feature involves data)*

- **RegleCompletude** : représente une règle de complétude du référentiel. Attributs clés : champ visé (nom du champ de la fiche agent), catégorie d'agent concernée, caractère obligatoire (booléen), poids dans le calcul du taux. Plusieurs règles peuvent viser le même champ pour des catégories différentes.
- **Employe (existant, étendu)** : fiche agent. Attributs de complétude ajoutés : taux de complétude calculé, liste des champs manquants (en clair), date du dernier calcul. Le calcul dépend du statut de l'agent (actif ou non) et de sa catégorie.
- **RapportImport** : représente le résultat d'une exécution d'import Excel. Attributs clés : date d'exécution, nombre total de lignes, nombre de lignes acceptées, nombre de lignes rejetées, et le détail par ligne rejetée (numéro de ligne, matricule si disponible, motif/liste des champs manquants).
- **Service (existant)** : sert de dimension d'agrégation pour les taux de complétude et la liste des dossiers incomplets.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100 % des agents actifs ayant au moins un champ obligatoire manquant apparaissent dans l'écran des dossiers incomplets avec le nom exact du ou des champs manquants.
- **SC-002**: Le compteur « Dossier complet » d'un agent dont tous les champs obligatoires sont renseignés affiche un taux strictement supérieur à 0 % (et 100 % si tous les champs pondérés sont renseignés), pour la totalité des agents concernés.
- **SC-003**: Après modification d'une fiche agent, le taux de complétude affiché est à jour immédiatement au rechargement de la fiche, sans attendre le recalcul nocturne.
- **SC-004**: 100 % des exécutions d'import Excel produisent un rapport exploitable indiquant les lignes acceptées et rejetées avec motif, sans qu'aucune ligne incomplète (au sens des règles obligatoires) ne soit insérée avec une valeur de substitution.
- **SC-005**: Le recalcul nocturne traite l'intégralité des agents actifs en base sans intervention manuelle, et met à jour leur date de dernier calcul pour au moins 99 % d'entre eux à l'issue de l'exécution.
- **SC-006**: Les responsables RH peuvent, en moins de 2 minutes, identifier depuis les écrans de complétude quel service a le taux de fiabilité de dossier le plus bas et quels champs y sont le plus fréquemment manquants.

## Assumptions

- Les règles de complétude obligatoires s'appliquent en priorité aux agents dont le statut est « actif » ; les agents retraités, partis ou mutés sont exclus du calcul de fiabilité de l'effectif « actif » mais restent visibles/traçables séparément (cf. edge cases et FR-017).
- Le calcul du taux de complétude est une moyenne pondérée : pour chaque agent, taux = somme des poids des champs obligatoires renseignés ÷ somme des poids des champs obligatoires applicables à sa catégorie, exprimée en pourcentage.
- Un import Excel qui rejette une ligne ne modifie ni ne crée aucun enregistrement pour l'agent concerné par cette ligne ; seules les lignes acceptées provoquent une écriture en base (alignement avec le comportement `updateOrCreate` existant, mais conditionné à la validation de complétude en amont).
- L'accès aux écrans de contrôle de complétude et au rapport d'import est réservé aux utilisateurs ayant un rôle RH/administratif, conformément aux permissions déjà en place sur les autres écrans RH de la plateforme.
- Le recalcul nocturne s'exécute via une tâche planifiée existante ou nouvellement créée dans l'infrastructure applicative déjà en place, sans nécessiter de nouvelle infrastructure externe.
- Les catégories d'agent utilisées pour les règles de complétude correspondent aux valeurs déjà utilisées par le champ « catégorie » existant sur la fiche agent (ex. Cadre Supérieur, Cadre, Haute Maîtrise, Maîtrise, Exécution Principal, Exécution).
