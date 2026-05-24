<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\CongeController;
use App\Http\Controllers\CoursController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\EmployeController;
use App\Http\Controllers\EvaluationFormationController;
use App\Http\Controllers\FormationController;
use App\Http\Controllers\PieceJointeController;
use App\Http\Controllers\PlanFormationController;
use App\Models\Service;
use Illuminate\Support\Facades\Route;

// Public
Route::post('/login', [AuthController::class, 'login']);

// Protected — RH only
Route::middleware('auth:rh')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
// Référentiels
    Route::get('/services', fn () => response()->json(Service::orderBy('nom')->get(['id', 'nom'])));

// T-08 — CRUD Employés
    Route::get('/employes', [EmployeController::class, 'index']);
    Route::post('/employes/bulk-sync', [EmployeController::class, 'bulkSync']); // T-060
    Route::post('/employes', [EmployeController::class, 'store']);
    Route::get('/employes/{id}', [EmployeController::class, 'show']);
    Route::put('/employes/{id}', [EmployeController::class, 'update']);
    Route::delete('/employes/{id}', [EmployeController::class, 'destroy']);
    Route::put('/change-password',[AuthController::class ,'changePassword']);
    // MODULE 3 — Dashboard
    Route::get('/dashboard/stats', [DashboardController::class, 'stats']);

    // MODULE 1 — Congés
    Route::get('/conges', [CongeController::class, 'index']);
    Route::post('/conges', [CongeController::class, 'store']);
    Route::get('/conges/{id}', [CongeController::class, 'show']);
    Route::put('/conges/{id}', [CongeController::class, 'update']);
    Route::delete('/conges/{id}', [CongeController::class, 'destroy']);
    Route::get('/conges/{id}/fichier', [CongeController::class, 'downloadFichier']);

    // T-09 — Pièces Jointes
    Route::get('/employes/{id}/pieces-jointes', [PieceJointeController::class, 'index']);
    Route::post('/employes/{id}/pieces-jointes', [PieceJointeController::class, 'store']);
    Route::delete('/pieces-jointes/{id}', [PieceJointeController::class, 'destroy']);

    // MODULE FORMATION — Plans
    Route::get('/plans-formation',          [PlanFormationController::class, 'index']);
    Route::post('/plans-formation',         [PlanFormationController::class, 'store']);
    Route::get('/plans-formation/{id}',     [PlanFormationController::class, 'show']);
    Route::put('/plans-formation/{id}',     [PlanFormationController::class, 'update']);
    Route::delete('/plans-formation/{id}',  [PlanFormationController::class, 'destroy']);

    // MODULE FORMATION — Formations (routes fixes avant les wildcards)
    Route::get('/formations',               [FormationController::class, 'index']);
    Route::post('/formations',              [FormationController::class, 'store']);
    Route::get('/formations/export',        [FormationController::class, 'export']);
    Route::post('/formations/bulk-sync',    [FormationController::class, 'bulkSync']);
    Route::get('/formations/{id}',          [FormationController::class, 'show']);
    Route::put('/formations/{id}',          [FormationController::class, 'update']);
    Route::delete('/formations/{id}',       [FormationController::class, 'destroy']);

    // MODULE FORMATION — Inscriptions
    Route::post('/formations/{id}/employes',              [FormationController::class, 'inscrire']);
    Route::put('/formations/{id}/employes/{eid}',         [FormationController::class, 'updateInscription']);
    Route::delete('/formations/{id}/employes/{eid}',      [FormationController::class, 'desinscrire']);
    Route::get('/employes/{id}/formations',               [FormationController::class, 'formationsEmploye']);

    // MODULE FORMATION — Évaluations
    Route::get('/formations/{id}/evaluations',            [EvaluationFormationController::class, 'index']);
    Route::post('/formations/{id}/evaluations',           [EvaluationFormationController::class, 'store']);
    Route::put('/evaluations/{id}',                       [EvaluationFormationController::class, 'update']);
    Route::delete('/evaluations/{id}',                    [EvaluationFormationController::class, 'destroy']);

    // MODULE FORMATION — Cours
    Route::get('/cours',        [CoursController::class, 'index']);
    Route::post('/cours',       [CoursController::class, 'store']);
    Route::get('/cours/{id}',   [CoursController::class, 'show']);
    Route::put('/cours/{id}',   [CoursController::class, 'update']);
    Route::delete('/cours/{id}',[CoursController::class, 'destroy']);

    // Dashboard — stats formations
    Route::get('/dashboard/formations-stats',             [DashboardController::class, 'formationsStats']);
});
