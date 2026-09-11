# Phase 0 Research: Documents employés (remplace Absences)

## 1. État actuel de la section Absences

**Decision**: Le retrait se limite à la couche présentation.

**Rationale**: `frontend/src/App.jsx:80` définit `/absences` comme un simple `<Placeholder title="Absences" />` — aucune vue fonctionnelle n'existe. `Sidebar.jsx` référence l'entrée `absences` pour les rôles `rh` (ligne 27) et `employe` (ligne 37), avec l'icône `CalendarCheck`. Le modèle Eloquent `Absence` existe côté backend (`app/Models/Absence.php`) et `PieceJointe::ENTITE_MAP` le référence comme type d'entité pouvant recevoir des pièces jointes, mais **aucune migration ni table `absences` n'existe** dans `database/database.sqlite` local ni dans `database/migrations/` — le schéma réel de production est provisionné hors du cycle de migration Laravel (cohérent avec la synchro Excel→plateforme documentée dans la mémoire projet). Aucune route API n'expose `/absences` aujourd'hui.

**Alternatives considered**: Supprimer aussi le modèle et la référence dans `ENTITE_MAP` immédiatement — rejeté car le spec (FR-014) exige explicitly de ne rien supprimer côté données tant que les dépendances n'ont pas été vérifiées, et parce que la table n'étant pas gérée par migration ici, une suppression de code ne doit pas devancer une vérification en environnement réel.

## 2. Modèle de données documentaire existant

**Decision**: Réutiliser et étendre `PieceJointe` (table `pieces_jointes`) comme entité principale des documents employé plutôt que de créer un nouveau modèle.

**Rationale**: `PieceJointe` est déjà polymorphe (`entite` / `entite_id`) et supporte le type `employe`. Le contrôleur `PieceJointeController` fournit déjà `index($employe_id)`, `store($employe_id)` et `destroy($id)` avec upload, validation MIME/taille (5 Mo, `pdf,jpg,jpeg,png,doc,docx`) et suppression logique via le flag `actif`. Le frontend `FicheEmploye.jsx` utilise déjà ces trois endpoints dans son onglet "Documents". Étendre l'existant minimise la duplication et respecte le principe de simplicité.

**Alternatives considered**: Utiliser `DossierPersonnel` (table `dossier_personnel`, colonnes `employe_id`, `type_piece`, `date_expiration`, `statut`) comme entité de document. Ce modèle porte déjà la notion de statut/expiration recherchée par la spec (via `isExpire()`), mais **aucune migration ni table réelle n'existe pour `dossier_personnel`** dans la base locale — le modèle semble non finalisé/orphelin. `FicheEmploye.jsx` l'affiche pourtant en lecture seule dans un tableau séparé ("Document / Numéro pièce") distinct de la liste des pièces jointes téléversées, ce qui suggère un existant partiellement construit sans backend actif. Rejeté comme entité principale de cette feature car non fiable en l'état ; à traiter comme risque d'intégration (section 6) plutôt que fondation.

## 3. Ajout des attributs statut/expiration/obligatoire

**Decision**: Ajouter à `pieces_jointes` (via migration) : `date_expiration` (date, nullable), `statut` (string/enum, nullable, valeurs `valide|a_renouveler|expire|manquant`), `obligatoire` (boolean, défaut `false`).

**Rationale**: Ce sont les seuls attributs manquants pour satisfaire FR-008 et FR-015 sans dupliquer une structure de catégories déjà couverte par le champ `categorie` existant (string libre, déjà utilisé). Le statut "Manquant" ne correspond pas à une ligne de `pieces_jointes` existante : il doit être dérivé en comparant, pour chaque employé, la liste des catégories obligatoires attendues à celles réellement présentes — voir data-model.md.

**Alternatives considered**: Stocker le statut comme valeur calculée uniquement (sans colonne `statut`) en dérivant systématiquement de `date_expiration` — rejeté car certains documents (ex. décision administrative) n'ont pas de date d'expiration mais peuvent quand même être marqués "à renouveler" manuellement par le RH ; une colonne explicite laisse ce contrôle au RH tout en gardant un calcul automatique par défaut pour les documents datés.

## 4. Téléchargement sécurisé des documents

**Decision**: Introduire une route de téléchargement dédiée passant par le contrôleur (`GET /pieces-jointes/{id}/download`, retournant une réponse fichier Laravel), plutôt que de continuer à exposer l'URL publique actuelle (`Storage::url($chemin)` sur le disque `public`).

**Rationale**: Le plan existant (`plan.md` racine du dépôt) et FR-005/FR-012 exigent explicitement de ne pas exposer les fichiers via une URL publique directe. Actuellement `PieceJointe::getUrlAttribute()` retourne une URL publique — c'est une régression de sécurité à corriger dans le cadre de cette feature. Une route protégée par le guard `auth:rh` (et, à terme, tout guard employé/DG) avec vérification d'appartenance du document à l'employé demandé répond à FR-010.

**Alternatives considered**: Générer des URLs signées temporaires (Laravel signed URLs) sur le disque public — rejeté pour cette feature car cela nécessite encore un disque public accessible sans authentification de session, alors qu'un contrôleur protégé par middleware réutilise directement le système d'autorisation déjà en place pour le reste de l'API.

## 5. Contrôle d'accès RH / Employé / DG

**Decision**: Documenter le contrat cible (RH : accès complet ; Employé : lecture de ses propres documents uniquement ; DG : lecture seule sur les employés autorisés) comme exigence de cette feature, en s'appuyant sur le mécanisme de rôle déjà utilisé côté frontend (`ProtectedRoute allowedRoles=[...]`, menus `Sidebar` par rôle) pour le routage, et sur le middleware Laravel pour l'autorisation côté serveur.

**Rationale**: Le frontend a déjà un système de rôles (`rh`, `dg`, `employe`) utilisé pour d'autres modules (`/conges`, `/mes-formations`, `/rapport-activite`). **Constat important** : côté backend, `AuthController::login`/`me` renvoient aujourd'hui systématiquement `'role' => 'rh'` et il n'existe qu'un seul guard Sanctum (`auth:rh`, provider `responsable_rh`) — il n'y a donc **pas encore d'authentification Employé ou DG distincte côté serveur**. Ce n'est pas un manque introduit par cette feature ; c'est une limite préexistante de l'application entière (les autres modules "employé"/"DG" du frontend semblent construits par anticipation d'un système de rôles qui n'est pas encore branché côté API).

**Impact sur cette feature**: les endpoints "Documents employés" côté RH (User Story 1) peuvent être pleinement sécurisés dès maintenant via le guard existant. Les accès Employé (US2) et DG (US3) doivent être conçus avec le même contrat d'autorisation que les autres modules déjà "prêts pour le futur système de rôles" de l'application (c.-à-d. vérifications d'appartenance/lecture-seule prévues dans le contrôleur et prêtes à s'activer dès qu'un guard Employé/DG existera), sans bloquer cette feature sur la refonte globale de l'authentification, qui est hors périmètre.

**Alternatives considered**: Bloquer cette feature jusqu'à l'implémentation complète de l'authentification multi-rôle côté backend — rejeté : hors périmètre de la demande initiale (retrait Absences + documents employés) et bloquerait une valeur livrable dès la User Story 1 (RH), qui est indépendamment testable.

## 6. Risques identifiés

- **Risque** : `DossierPersonnel` référence une table absente ; si le futur travail décide de fusionner "documents" et "dossier personnel", une migration de données sera nécessaire. *Mitigation* : ne pas coupler cette feature à `DossierPersonnel`; le signaler dans les tâches de suivi.
- **Risque** : Le schéma réel de production (`pieces_jointes`, `employes`, etc.) n'est pas géré par les migrations de ce dépôt. *Mitigation* : toute migration ajoutée par cette feature doit être écrite de façon idempotente/réversible et vérifiée manuellement contre l'environnement réel avant déploiement (cf. FR-014 et étape d'audit du `plan.md` existant).
- **Risque** : L'absence de guard Employé/DG côté backend signifie que, tant que ce guard n'existe pas, l'accès "Employé"/"DG" aux documents reste appliqué uniquement côté frontend (protection de routage), ce qui n'est pas une garantie de sécurité suffisante en soi. *Mitigation* : le contrôleur backend doit être écrit pour accepter dès maintenant un identifiant d'employé courant issu de l'utilisateur authentifié (quel que soit le guard), afin d'éviter une deuxième réécriture lors du branchement du guard Employé.
