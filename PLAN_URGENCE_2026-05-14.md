# 🚨 PLAN ESSENTIEL — DEADLINE 31 MAI 2026
## Automatisation RH | AHU | 17 jours | Solo Developer

> **Règle d'or :** Zéro module non-visible en soutenance = Zéro à coder.
> **MVP strict :** Auth + Personnel + Congés + Dashboard. Point final.

---

## 📅 VUE CALENDRIER — 17 JOURS

```text
MAI 2026
┌──────┬──────┬──────┬──────┬──────┬──────┬──────┐
│  14  │  15  │  16  │  17  │  18  │  19  │  20  │
│SETUP │SETUP │ AUTH │ AUTH │PERSO │PERSO │CONGÉ │
│      │      │ API  │ RCT  │ API  │ RCT  │ API  │
├──────┼──────┼──────┼──────┼──────┼──────┼──────┤
│  21  │  22  │  23  │  24  │  25  │  26  │  27  │
│CONGÉ │DASH  │DASH  │INTEG │INTEG │  QA  │  QA  │
│ RCT  │ API  │ RCT  │      │      │      │ FIX  │
├──────┼──────┼──────┼──────┼──────┼──────┼──────┤
│  28  │  29  │  30  │  31  │
│DEPLO │DEPLO │RAPRT │RAPRT │
│      │      │      │ 🏁   │
└──────┴──────┴──────┴──────┘
```

---

## 🎯 MVP FINAL — 4 MODULES SEULEMENT

| Module | Pourquoi essentiel |
|--------|--------------------|
| 🔐 Auth & Rôles | Sans ça, rien ne marche |
| 👥 Personnel | Core métier — obligatoire PFE |
| 🏖️ Congés | Workflow le plus démontrable |
| 📊 Dashboard | Impact visuel fort pour le jury |

**❌ Coupé du scope :** Formations, Médical AFMA, Stages, Réclamations, SMQ

---

# ⚡ SPRINT 1 | 14–19 Mai (6 jours)
### SETUP + AUTH + PERSONNEL BACKEND

**Objectif :** Backend 100% fonctionnel. APIs testées Postman. Zéro frontend encore.

### 📋 TÂCHES ESSENTIELLES SPRINT 1

| # | Tâche | Jour | Durée | Priorité |
|---|-------|------|-------|----------|
| **T-01** | Init Laravel 11 + `.env` + MySQL `rh_ahu` | Jour 1 | 1h | 🔴 BLOQUANT |
| **T-02** | Migrations : 8 tables MVP uniquement | Jour 1 | 2h | 🔴 BLOQUANT |
| **T-03** | Init React 18 + Tailwind + Router + Axios | Jour 1 | 1h | 🔴 BLOQUANT |
| **T-04** | API Login + Logout + `/me` (Sanctum) | Jour 2 | 2h | 🔴 BLOQUANT |
| **T-05** | Middleware rôles (4 rôles) + protection routes | Jour 2 | 2h | 🔴 BLOQUANT |
| **T-06** | Page Login React + token storage + redirect rôle | Jour 3 | 3h | 🔴 BLOQUANT |
| **T-07** | `ProtectedRoute` React par rôle | Jour 3 | 1h | 🔴 BLOQUANT |
| **T-08** | API CRUD Employés (liste, détail, créer, modifier) | Jour 4 | 3h | 🔴 BLOQUANT |
| **T-09** | API Upload Pièces Jointes (fichiers dossier) | Jour 4 | 2h | 🟠 Important |
| **T-10** | Page Liste Employés React (table + filtre) | Jour 5 | 3h | 🔴 BLOQUANT |
| **T-11** | Page Fiche Employé React (profil + dossier) | Jour 5 | 3h | 🔴 BLOQUANT |
| **T-12** | ✅ TEST POSTMAN Sprint 1 + commit GitHub | Jour 6 | 2h | 🔴 BLOQUANT |

**Total Sprint 1 : 12 tâches | ~25h | 6 jours**

### 8 Tables à migrer (MVP uniquement)

```sql
service            → référentiel services
employe            → fiche employé complète
responsable_rh     → hérite de employe
dossier_personnel  → documents administratifs
historique_professionnel → mutations/affectations
demande_conge      → congés
absence            → absences
pieces_jointes     → fichiers centralisés
```

### Definition of Done Sprint 1

- [ ] `php artisan migrate` → 0 erreur
- [ ] Login retourne un token valide
- [ ] Accès `/api/employes` avec token → liste JSON
- [ ] Accès sans token → 401
- [ ] Page Login React fonctionne
- [ ] Liste employés s'affiche dans React
- [ ] GitHub commit : `feat: sprint-1-auth-personnel`

---

# ⚡ SPRINT 2 | 20–25 Mai (6 jours)
### CONGÉS + DASHBOARD + FRONTEND COMPLET

**Objectif :** Application complète et intégrée. Tout fonctionne end-to-end.

### 📋 TÂCHES ESSENTIELLES SPRINT 2

| # | Tâche | Jour | Durée | Priorité |
|---|-------|------|-------|----------|
| **T-13** | API Congés : soumettre + approuver + rejeter | Jour 7 | 3h | 🔴 BLOQUANT |
| **T-14** | API calcul solde congé automatique | Jour 7 | 1h | 🔴 BLOQUANT |
| **T-15** | Page React : Soumettre demande congé (employé) | Jour 8 | 2h | 🔴 BLOQUANT |
| **T-16** | Page React : Validation congés RH (approuver/rejeter) | Jour 8 | 3h | 🔴 BLOQUANT |
| **T-17** | API Dashboard : stats effectif + absentéisme + sexe | Jour 9 | 2h | 🔴 BLOQUANT |
| **T-18** | API Dashboard : congés consommés + besoins effectif | Jour 9 | 1h | 🟠 Important |
| **T-19** | Dashboard React : KPI Cards (4 indicateurs) | Jour 10 | 2h | 🔴 BLOQUANT |
| **T-20** | Dashboard React : 2 graphiques Recharts (bar + pie) | Jour 10 | 3h | 🔴 BLOQUANT |
| **T-21** | Layout Sidebar par rôle + Navbar + Logout | Jour 11 | 3h | 🔴 BLOQUANT |
| **T-22** | Composants UI : Table, Modal, Badge, Toast | Jour 11 | 2h | 🟠 Important |
| **T-23** | Responsive mobile + tablette (Tailwind) | Jour 12 | 2h | 🟠 Important |
| **T-24** | ✅ TEST END-TO-END complet + commit GitHub | Jour 12 | 2h | 🔴 BLOQUANT |

**Total Sprint 2 : 12 tâches | ~26h | 6 jours**

### Definition of Done Sprint 2

- [ ] Workflow congé complet fonctionne (soumettre → approuver → solde mis à jour)
- [ ] Dashboard affiche données réelles (pas de mock)
- [ ] Navigation sidebar fonctionne pour les 3 rôles
- [ ] Responsive validé 375px + 768px + 1280px
- [ ] Aucune erreur console JavaScript
- [ ] GitHub commit : `feat: sprint-2-conges-dashboard-frontend`

---

# ⚡ SPRINT 3 | 26–31 Mai (6 jours)
### QA + DÉPLOIEMENT + RAPPORT PFE

**Objectif :** Application stable en production. Rapport PFE remis. Prêt soutenance.

### 📋 TÂCHES ESSENTIELLES SPRINT 3

| # | Tâche | Jour | Durée | Priorité |
|---|-------|------|-------|----------|
| **T-25** | QA Checklist Auth (login, 401, 403, rôles) | Jour 13 | 2h | 🔴 BLOQUANT |
| **T-26** | QA Checklist Personnel (CRUD, upload, filtres) | Jour 13 | 2h | 🔴 BLOQUANT |
| **T-27** | QA Checklist Congés (workflow complet, solde) | Jour 14 | 2h | 🔴 BLOQUANT |
| **T-28** | QA Checklist Dashboard + Responsive | Jour 14 | 2h | 🔴 BLOQUANT |
| **T-29** | Correction bugs critiques QA | Jour 14 | 3h | 🔴 BLOQUANT |
| **T-30** | Build React prod + déploiement Netlify | Jour 15 | 2h | 🔴 BLOQUANT |
| **T-31** | Déploiement Laravel VPS (Docker ou shared hosting) | Jour 15 | 3h | 🔴 BLOQUANT |
| **T-32** | Config `.env` prod + SSL + test final en ligne | Jour 16 | 2h | 🔴 BLOQUANT |
| **T-33** | Screenshots interface + rédaction rapport PFE | Jour 16 | 3h | 🔴 BLOQUANT |
| **T-34** | Slides soutenance (10-15 slides) + démo préparée | Jour 17 | 3h | 🔴 BLOQUANT |

**Total Sprint 3 : 10 tâches | ~24h | 6 jours**

### Definition of Done Sprint 3 (= Definition of Done PROJET)

- [ ] 0 bug critique en production
- [ ] URL frontend live et accessible
- [ ] URL API backend live et accessible
- [ ] Rapport PFE remis
- [ ] Slides prêts
- [ ] Démo scénario préparé (Employé + RH + DG)

---

## 📊 RÉCAPITULATIF FINAL

| Sprint | Dates | Tâches | Heures | Livrables |
|--------|-------|--------|--------|-----------|
| Sprint 1 | 14–19 Mai | 12 | ~25h | Backend complet + Auth + Personnel |
| Sprint 2 | 20–25 Mai | 12 | ~26h | Congés + Dashboard + Frontend intégré |
| Sprint 3 | 26–31 Mai | 10 | ~24h | QA + Déploiement + Rapport PFE |
| **TOTAL** | **17 jours** | **34 tâches** | **~75h** | **Application PFE complète** |

---

## ⚠️ RÈGLES DE SURVIE

1. Ne commence JAMAIS le frontend avant que l'API soit testée Postman.
2. Commit GitHub chaque soir (même partiel).
3. Si une tâche dépasse 2x son estimation → la simplifier, pas l'abandonner.
4. Modules bonus (Formations, AFMA) = INTERDITS avant le 26 Mai.
5. Le rapport PFE commence le 29 Mai, pas avant et pas après.

---

## 🎬 SCÉNARIO DÉMO SOUTENANCE (à préparer J-17)

```text
Acteur 1 — RH Admin :
  → Login → Dashboard KPIs → Ajouter un employé → Valider une demande de congé

Acteur 2 — Employé :
  → Login → Voir ma fiche → Soumettre demande congé → Voir mon solde

Acteur 3 — DG :
  → Login → Consulter Dashboard → Voir répartition effectif
```

---

*Plan généré le 14 Mai 2026 — Version URGENCE*  
*Objectif : Application PFE livrée et déployée le 31 Mai 2026*
