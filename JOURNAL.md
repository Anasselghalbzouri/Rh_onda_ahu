# Journal de développement — RH ONDA

## 16 Mai 2026 — Sprint 1 (suite)

### Ce qu'on a fait aujourd'hui

#### T-08 — CRUD complet Employés (backend)
- `GET /api/employes/{id}` — fiche employé avec relations (`service`, `dossier_personnel`, `historique_professionnel`)
  - Recherche par `id` **ou** par `matricule`
- `POST /api/employes` — créer un employé
- `PUT /api/employes/{id}` — modifier un employé
- `DELETE /api/employes/{id}` — supprimer un employé
- Fichier modifié : `backend/app/Http/Controllers/EmployeController.php`

#### T-09 — API Pièces Jointes (backend)
- `GET /api/employes/{id}/pieces-jointes` — liste des fichiers actifs
- `POST /api/employes/{id}/pieces-jointes` — upload fichier (pdf, jpg, jpeg, png, doc, docx, max 5 Mo)
- `DELETE /api/pieces-jointes/{id}` — suppression douce (`actif = false`) + suppression du fichier physique
- Fichier créé : `backend/app/Http/Controllers/PieceJointeController.php`
- Routes ajoutées dans : `backend/routes/api.php`

#### T-11 — FicheEmploye.jsx (frontend)
- Navigation : clic sur une ligne dans `ListeEmployes` → ouvre la fiche
- Bouton "Retour" → revient à la liste
- **Section 1** — Header : nom complet, matricule, badge statut coloré
- **Section 2** — Infos générales : grille de 12 champs (sexe, dates, catégorie, fonction, service…)
- **Section 3** — Solde congé : affichage grand nombre
- **Section 4** — Dossier Personnel : tableau avec badges statut (vert/rouge/jaune)
- **Section 5** — Historique Professionnel : tableau trié par date DESC
- **Section 6** — Pièces Jointes : liste avec téléchargement, suppression + formulaire d'upload
- Fichier créé : `frontend/src/FicheEmploye.jsx`
- Fichiers modifiés : `frontend/src/Dashboard.jsx`, `frontend/src/ListeEmployes.jsx`

#### Corrections effectuées
- `ResponsableRh.$fillable` : ajout de `'id'`
- Mot de passe ResponsableRh (id=1) réinitialisé à `password123`
- Merge de la branche `worktree-t11-fiche-employe` → `main`

---

## 17 Mai 2026 — À faire demain

### Priorité 1 — Tester T-11
- [ ] Lancer le backend : `cd backend && php artisan serve`
- [ ] Lancer le frontend : `cd frontend && npm run dev`
- [ ] Se connecter avec le compte RH (`password123`)
- [ ] Cliquer sur un employé → vérifier les 6 sections
- [ ] Tester l'upload d'un fichier dans la section Pièces Jointes
- [ ] Tester la suppression d'un fichier

### Priorité 2 — Commit final Sprint 1
```bash
git add .
git commit -m "feat: sprint-1 complete — T08 CRUD employés, T09 pièces jointes, T11 FicheEmploye"
```

---

## Sprint 2 — À partir du 20 Mai 2026

| Tâche | Description | Priorité |
|-------|-------------|----------|
| T-13 | API Congés — demande, liste, solde | Haute |
| T-14 | API Congés — approbation / refus par RH | Haute |
| T-15 | GestionConges.jsx — liste des demandes | Haute |
| T-16 | GestionConges.jsx — formulaire de demande | Haute |
| T-17 | API stats Dashboard (nb employés, congés en attente…) | Moyenne |
| T-18 | API stats avancées (par service, par mois) | Moyenne |
| T-19 | DashboardStats.jsx avec Recharts | Moyenne |
| T-20 | Graphiques avancés (histogramme, camembert) | Basse |
| T-21 | Sidebar layout + navigation globale | Haute |

---

## Stack technique

| Couche | Techno |
|--------|--------|
| Backend | Laravel 13, PHP 8.3, Sanctum (`auth:rh`) |
| Base de données | MySQL — `rh_ahu` @ 127.0.0.1:3306 |
| Frontend | React 19, Vite, inline styles |
| Auth | Bearer token dans `localStorage`, guard `rh` |
| Fichiers | `Storage::disk('public')`, dossier `pieces_jointes/{employe_id}/` |
