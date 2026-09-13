# Quickstart: Qualité et Complétude du Référentiel

## Prérequis

- Backend Laravel opérationnel (`cd backend && composer run setup` si première utilisation)
- Base migrée à jour : `php artisan migrate` (inclut les migrations de cette feature)
- Frontend React opérationnel (`cd frontend && npm install`)
- Au moins un utilisateur RH authentifié pour appeler l'API

## 1. Vérifier les règles de complétude par défaut

```bash
cd backend
php artisan tinker --execute="dd(App\Models\RegleCompletude::all(['champ','categorie','obligatoire','poids'])->toArray())"
```

**Résultat attendu** : 8 règles couvrant `fonction`, `service_id`, `entite`, `date_embauche`, `categorie`, `echelle`, `echelon`, `date_naissance`, toutes `categorie = null` (s'appliquent à toutes les catégories), `obligatoire = true`.

## 2. Reproduire puis corriger le bug « Dossier complet 0 % »

```bash
php artisan tinker --execute="
  \$e = App\Models\Employe::factory()->create(['statut' => 'actif', 'fonction' => 'Contrôleur', 'service_id' => 1, 'entite' => 'ONDA', 'date_embauche' => '2020-01-01', 'categorie' => 'Cadre', 'echelle' => '5', 'echelon' => '2', 'date_naissance' => '1990-01-01']);
  app(App\Services\CompletudeService::class)->recalculer(\$e);
  \$e->refresh();
  dd(['taux' => \$e->taux_completude, 'manquants' => \$e->champs_manquants]);
"
```

**Résultat attendu** : `taux = 100`, `manquants = []` — même sans aucune pièce jointe/document attaché (ce qui corrige le symptôme initial où le taux dépendait des documents).

## 3. Écran « Dossiers incomplets »

```bash
# Backend démarré (composer run dev), puis :
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/completude/dossiers-incomplets
```

**Résultat attendu** : un agent actif sans `fonction` apparaît sous son service avec `"Fonction manquante"` dans `champs_manquants`.

Côté UI : `npm run dev` dans `frontend/`, ouvrir l'écran « Dossiers incomplets » (nouveau menu), vérifier le regroupement par service et le libellé en clair du champ manquant.

## 4. Écran « Taux de complétude »

```bash
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/completude/taux
```

**Résultat attendu** : un `taux_moyen` par service et par catégorie, cohérent avec le nombre d'agents actifs complets/incomplets (voir `contracts/completude-api.md`).

## 5. Import Excel — rejet d'une ligne incomplète

1. Préparer un fichier Excel avec deux lignes pour des agents `actif` : une complète, une sans `fonction` ni `entite`.
2. Importer via l'écran d'import existant (`ImportExcelModal`) ou :
   ```bash
   curl -X POST -H "Authorization: Bearer <token>" -F "fichier=@test_import.xlsx" http://localhost:8000/api/employes/import
   ```
3. **Résultat attendu** :
   - La ligne complète crée/met à jour l'employé normalement.
   - La ligne incomplète ne crée ni ne modifie aucun employé.
   - La réponse contient `import_rapport_id` ; `GET /api/import/rapports/{id}` renvoie cette ligne dans `lignes_rejetees_detail` avec le motif `"Fonction manquante, Entité manquante"`.

## 6. Recalcul nocturne

```bash
php artisan app:recalculer-completude
```

**Résultat attendu** : tous les employés voient leur `date_dernier_calcul` mise à jour ; vérifier via :
```bash
php artisan tinker --execute="dd(App\Models\Employe::whereDate('date_dernier_calcul', today())->count())"
```
doit être égal au nombre total d'employés en base.

Vérifier également que la commande est bien planifiée : `php artisan schedule:list` doit afficher `app:recalculer-completude` avec une fréquence quotidienne.

## 7. Vérification du tableau de bord

Ouvrir `Dashboard.jsx` (frontend) et confirmer que les nouvelles statistiques de fiabilité par service (issues de `GET /api/completude/taux`) s'affichent sans erreur, et que `FicheEmploye.jsx` affiche désormais `employe.taux_completude` (et non plus le ratio de pièces jointes) pour le compteur « Dossier complet ».
