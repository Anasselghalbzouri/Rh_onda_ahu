# Research: Qualité et Complétude du Référentiel

## R1 — Où est réellement calculé le compteur « Dossier complet » aujourd'hui ?

**Decision**: Le compteur affiché dans `FicheEmploye.jsx` (`dossierCompleteness`, ligne ~219) est calculé côté frontend à partir de `dossier_personnel` (documents administratifs attachés), et non à partir des champs métier de la fiche (fonction, service, date d'embauche, etc.) : `dossierValides / dossierTotal`. Quand aucun document n'est attaché (`dossierTotal === 0`), le taux tombe à `0` — ce qui reproduit exactement le symptôme décrit par l'utilisateur.

**Rationale**: Confirmé en lisant le fichier source. Il n'existe aujourd'hui aucune colonne ni service backend qui calcule un taux de complétude du profil.

**Alternatives considered**: Corriger uniquement le calcul frontend en le basant sur les champs déjà chargés par `EmployeController::show`. Rejeté : ne satisferait pas FR-001 à FR-006 (règles configurables, persistance, recalcul nocturne, écrans agrégés par service/catégorie) — il faut une source de vérité backend persistée, pas un calcul ad hoc côté client.

## R2 — Comment modéliser des règles de complétude configurables par catégorie ?

**Decision**: Une table `regle_completude` avec les colonnes `champ` (string, nom du champ ciblé sur `employe`), `categorie` (string nullable — `null` signifie "toutes catégories"), `obligatoire` (boolean), `poids` (integer/decimal), `actif` (boolean). Le calcul pour un employé donné sélectionne les règles actives dont `categorie` est `null` ou égale à `employe.categorie`.

**Rationale**: Correspond exactement à la donnée demandée dans le brief (« champ visé, catégorie d'agent concernée, caractère obligatoire, poids dans le calcul ») et permet d'ajouter/modifier des règles sans migration (Edge case : nouvelle règle appliquée après recalcul).

**Alternatives considered**: Coder les règles en dur dans le service (`CompletudeService`). Rejeté : le brief demande explicitement une donnée `regle_completude` pilotable, et une table permet l'écran de gestion futur sans redéploiement.

## R3 — Comment calculer le taux de complétude (pondération) ?

**Decision**: Taux = (somme des poids des règles obligatoires satisfaites) ÷ (somme des poids de toutes les règles obligatoires applicables à la catégorie de l'employé) × 100, arrondi à l'entier. Si aucune règle obligatoire n'est applicable (cas théorique), le taux est 100 % (rien à satisfaire) plutôt que 0 % — évite un nouveau "faux 0 %".

**Rationale**: Reflète l'intention du brief ("poids dans le calcul") tout en restant simple et déterministe ; documenté comme hypothèse dans `spec.md` (section Assumptions).

**Alternatives considered**: Moyenne non pondérée (chaque champ compte pour 1). Rejeté car le brief mentionne explicitement un poids par règle.

## R4 — Qu'est-ce qu'une valeur "manquante" (au-delà de `NULL`) ?

**Decision**: Un champ est manquant si sa valeur est `null`, une chaîne vide, une chaîne ne contenant que des espaces, ou un texte placeholder connu (`-`, `--`, `N/A`, `n/a`) après `trim()`. La normalisation est centralisée dans `CompletudeService::estManquant(mixed $valeur): bool`.

**Rationale**: Couvre l'edge case explicitement mentionné dans `spec.md` ("chaîne composée uniquement d'espaces, ou un tiret `-` inséré par un ancien import").

**Alternatives considered**: Ne tester que `null`/`''`. Rejeté : n'aurait pas couvert les tirets déjà présents en base issus d'anciens imports.

## R5 — Où appliquer le contrôle de complétude à l'import Excel sans casser l'existant ?

**Decision**: Ajouter une étape de validation dans `ImportController::syncFromExcel` (et `importFromFile`) **avant** l'appel à `Employe::updateOrCreate` : construire les données comme aujourd'hui, exécuter `CompletudeService::champsManquantsPour($categorie, $donneesFusionnees)` sur les champs obligatoires pour un agent avec `statut === 'actif'`, et si des champs obligatoires manquent, sauter la ligne (comme le fait déjà le code pour un matricule vide) en l'ajoutant à `errors`/à un nouveau tableau `rejets` avec le motif, sans appeler `updateOrCreate`.

**Rationale**: Réutilise le contrôle de flux déjà existant (`try/catch`, `$errors[]`, compteurs `inserted/updated/skipped`) plutôt que de le réécrire ; minimise le risque de régression sur les deux endpoints d'import déjà en production.

**Alternatives considered**: Créer un nouveau contrôleur d'import séparé. Rejeté : dupliquerait la logique de normalisation (catégorie, sexe, dates) déjà présente dans `ImportController` et risquerait une divergence de comportement entre les deux chemins d'import.

## R6 — Comment persister et exposer le "rapport d'import" (lignes acceptées/rejetées/motif) ?

**Decision**: Deux nouvelles tables : `import_rapport` (une ligne par exécution : date, total, acceptees, rejetees, origine `manuel`/`sync_excel`) et `import_rapport_ligne` (une ligne par ligne rejetée : numéro de ligne, matricule si connu, motif — liste des champs manquants concaténée). `ImportController` crée ces enregistrements à la fin de chaque exécution ; un nouvel endpoint `GET /api/import/rapports` et `GET /api/import/rapports/{id}` les expose au frontend.

**Rationale**: Le brief demande un écran de rapport d'import persistant (lignes acceptées/rejetées/motif), pas seulement une réponse JSON éphémère de la requête HTTP courante — utile pour consulter l'historique après coup.

**Alternatives considered**: Ne renvoyer les rejets que dans la réponse JSON de l'appel d'import (comportement actuel avec `errors`). Rejeté : ne permettrait pas de consulter le rapport plus tard ni de l'agréger dans le temps, et le brief liste "Rapport d'import Excel" comme écran à part entière.

## R7 — Comment déclencher le recalcul "à chaque enregistrement de fiche" et "une fois par nuit" ?

**Decision**: (a) Dans `EmployeController::store`/`update` (et dans `ImportController` après une écriture réussie), appeler `CompletudeService::recalculer(Employe $employe)` juste après la sauvegarde, dans la même requête — le volume par requête est de 1 employé, donc négligeable en performance. (b) Ajouter une commande Artisan `app:recalculer-completude` qui parcourt tous les employés par lot (`chunk`) et appelle le même service ; la planifier via `Schedule::command('app:recalculer-completude')->daily()` dans `routes/console.php` (Laravel 13 utilise le scheduler natif, sans package externe) — aucune tâche planifiée n'existe encore dans le projet, celle-ci sera la première.

**Rationale**: Réutilise le même service de calcul dans les deux cas (pas de double logique), respecte FR-005/FR-006, et s'appuie sur le scheduler Laravel déjà disponible dans le framework sans dépendance supplémentaire.

**Alternatives considered**: Recalcul via un Job en file d'attente (`ShouldQueue`) pour chaque sauvegarde de fiche. Rejeté pour le recalcul unitaire (calcul trop léger pour justifier la latence/complexité d'une queue) mais retenu comme option pour le recalcul nocturne si le volume d'employés devient trop important pour une commande synchrone — non nécessaire à l'échelle actuelle (quelques milliers de lignes).

## R8 — Où placer les nouveaux écrans côté frontend ?

**Decision**: Un nouveau dossier `frontend/src/components/CompletudePage/` avec une page à onglets/sous-vues (dossiers incomplets par service, taux par service/catégorie), suivant le même patron visuel et de récupération de données (`api.get(...)`) que `RapportActivitePage` et `RapportEmployesPage`. Le rapport d'import est intégré à `ui/ImportExcelModal` (déjà utilisé pour afficher le résultat d'un import) plutôt qu'un troisième écran isolé, avec un lien vers l'historique complet si besoin.

**Rationale**: Cohérence avec les conventions existantes (un composant par écran, CSS colocalisé) et réutilisation du composant de résultat d'import déjà connu des utilisateurs.

**Alternatives considered**: Une page unique fusionnant complétude + import. Rejeté : le brief distingue clairement 3 écrans avec des audiences/fréquences de consultation différentes (contrôle quotidien vs. rapport ponctuel après import).
