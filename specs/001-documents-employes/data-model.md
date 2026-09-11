# Phase 1 Data Model: Documents employés

## Entité: Document employé (`PieceJointe`, table `pieces_jointes`)

Étend l'entité existante (pas de nouvelle table). Colonnes actuelles conservées + ajouts.

| Champ | Type | Statut | Notes |
|---|---|---|---|
| `id` | integer PK | existant | |
| `entite` | string | existant | Fixé à `'employe'` pour cette feature |
| `entite_id` | integer | existant | FK logique vers `employes.id` |
| `nom_original` | string | existant | Nom du fichier tel qu'importé |
| `nom_stockage` | string | existant | Nom sur disque |
| `chemin` | string, nullable | existant | Chemin sur le disque `public` (voir décision de téléchargement sécurisé, research.md §4) |
| `extension` | string | existant | |
| `taille_octets` | integer | existant | |
| `mime_type` | string | existant | |
| `categorie` | string, nullable | existant | Voir liste de valeurs de référence ci-dessous (non contrainte en base, validée côté application) |
| `description` | string, nullable | existant | |
| `uploade_par` | integer FK → `responsable_rh.id` | existant | Utilisateur RH ayant ajouté le document (FR-013) |
| `date_upload` | datetime | existant | |
| `actif` | boolean | existant | `false` = supprimé logiquement |
| `date_expiration` | date, nullable | **nouveau** | Utilisé pour dériver `statut` automatiquement (FR-008) |
| `statut` | string, nullable | **nouveau** | `valide` \| `a_renouveler` \| `expire` \| `manquant`. Valeur calculée par défaut à partir de `date_expiration`, modifiable manuellement par le RH pour les documents sans date. `manquant` n'est jamais stocké : voir Entité dérivée ci-dessous |
| `obligatoire` | boolean, défaut `false` | **nouveau** | Marque un document comme requis pour l'employé (sert au calcul des documents manquants) |
| `supprime_par` | integer FK → `responsable_rh.id`, nullable | **nouveau** | Utilisateur ayant supprimé le document (FR-013) |

**Validation** (FR-012, existant à conserver) :
- Fichier requis, taille max 5 Mo, extensions `pdf,jpg,jpeg,png,doc,docx`.
- `categorie` limitée aux valeurs de référence (voir ci-dessous) au niveau de la validation applicative.
- `date_expiration` doit être une date valide si fournie ; pas de contrainte de futur strict (permet de corriger une saisie).

**Règle de dérivation du statut** (appliquée à la lecture, pas nécessairement stockée en base pour rester cohérente avec la date courante) :
- Si `date_expiration` est dépassée → `expire`.
- Si `date_expiration` est dans les 30 jours → `a_renouveler`.
- Sinon → `valide` (ou valeur manuelle si définie explicitement par le RH pour un document non daté).

## Entité dérivée : Document manquant

Il n'existe pas de ligne `pieces_jointes` pour un document "manquant" : c'est le résultat d'un calcul, par employé, entre :
- l'ensemble des catégories marquées `obligatoire = true` déjà utilisées pour au moins un employé (ou une liste de référence fixe côté application, voir Assumptions du spec), et
- l'ensemble des catégories effectivement présentes et actives (`actif = true`) pour cet employé.

Toute catégorie obligatoire absente pour un employé donné est présentée côté RH comme un document au statut `manquant`, sans ligne correspondante en base.

## Catégories de référence (valeurs de `categorie`)

Contrat, CIN, Diplôme, Attestation de travail, Certificat médical, Décision administrative, Formation, Photo, Dossier administratif, Autre — reprises de `plan.md` (racine du dépôt) et de la section Assumptions du spec.

## Relations

- `PieceJointe.entite_id` → `Employe.id` (relation logique existante, non typée en FK SQL car `entite` est polymorphe par convention applicative, pas par contrainte de base).
- `PieceJointe.uploade_par` / `supprime_par` → `ResponsableRh.id` (`belongsTo`, cohérent avec la relation `uploadePar()` déjà présente sur le modèle).

## État / transitions

```
[créé par upload RH] --(actif=true)--> [visible]
[visible] --(suppression + confirmation)--> [actif=false] (suppression logique, conservé pour audit)

statut (calculé, sauf saisie manuelle RH pour un document non daté) :
  valide -> a_renouveler   (date_expiration entre dans les 30 jours)
  a_renouveler -> expire   (date_expiration dépassée)
  (absence de ligne) -> manquant  (catégorie obligatoire non fournie pour l'employé)
```

## Hors périmètre de cette feature (voir research.md)

- `Absence` (modèle) et sa table : aucune modification de schéma, conservés tels quels (FR-014).
- `DossierPersonnel` : non utilisé comme fondation de cette feature (table absente de l'environnement observé) ; reste tel quel dans le code existant.
