<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\CongeController;
use App\Http\Controllers\CoursController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\EmployeController;
use App\Http\Controllers\EvaluationFormationController;
use App\Http\Controllers\FormationController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\PieceJointeController;
use App\Http\Controllers\PlanFormationController;
use App\Http\Controllers\RapportActiviteController;
use App\Http\Controllers\SuiviFormationController;
use App\Models\Service;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:rh')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    Route::get('/services', fn () => response()->json(Service::orderBy('nom')->get(['id', 'nom'])));

    Route::get('/employes' , [EmployeController::class, 'index']);
    Route::get('/employes/export', [EmployeController::class, 'export']);
    Route::post('/employes/bulk-sync', [EmployeController::class, 'bulkSync']);
    Route::post('/employes', [EmployeController::class, 'store']);
    Route::get('/employes/{id}', [EmployeController::class, 'show']);
    Route::put('/employes/{id}', [EmployeController::class, 'update']);
    Route::delete('/employes/{id}', [EmployeController::class, 'destroy']);
    Route::put('/change-password',[AuthController::class ,'changePassword']);

    Route::get('/dashboard/stats', [DashboardController::class, 'stats']);

    Route::get('/notifications',                 [NotificationController::class, 'index']);
    Route::post('/notifications/read-all',        [NotificationController::class, 'markAllRead']);
    Route::post('/notifications/{id}/read',       [NotificationController::class, 'markAsRead']);

    Route::get('/conges', [CongeController::class, 'index']);
    Route::post('/conges', [CongeController::class, 'store']);
    Route::get('/conges/{id}', [CongeController::class, 'show']);
    Route::put('/conges/{id}', [CongeController::class, 'update']);
    Route::delete('/conges/{id}', [CongeController::class, 'destroy']);
    Route::get('/conges/{id}/fichier', [CongeController::class, 'downloadFichier']);

    Route::get('/employes/{id}/pieces-jointes', [PieceJointeController::class, 'index']);
    Route::post('/employes/{id}/pieces-jointes', [PieceJointeController::class, 'store']);
    Route::delete('/pieces-jointes/{id}', [PieceJointeController::class, 'destroy']);
    Route::get('/pieces-jointes/{id}/download', [PieceJointeController::class, 'download']);
    Route::get('/documents-employes', [PieceJointeController::class, 'indexGlobal']);
    Route::get('/moi/pieces-jointes', [PieceJointeController::class, 'mesPieces']);

    Route::get('/plans-formation',          [PlanFormationController::class, 'index']);
    Route::post('/plans-formation',         [PlanFormationController::class, 'store']);
    Route::get('/plans-formation/{id}',     [PlanFormationController::class, 'show']);
    Route::put('/plans-formation/{id}',     [PlanFormationController::class, 'update']);
    Route::delete('/plans-formation/{id}',  [PlanFormationController::class, 'destroy']);

    // Les routes fixes (/export, /bulk-sync) doivent être déclarées avant les routes avec paramètre wildcard {id}.
    Route::get('/formations',               [FormationController::class, 'index']);
    Route::post('/formations',              [FormationController::class, 'store']);
    Route::get('/formations/export',        [FormationController::class, 'export']);
    Route::post('/formations/bulk-sync',    [FormationController::class, 'bulkSync']);
    Route::get('/formations/{id}',          [FormationController::class, 'show']);
    Route::put('/formations/{id}',          [FormationController::class, 'update']);
    Route::delete('/formations/{id}',       [FormationController::class, 'destroy']);

    Route::post('/formations/{id}/employes',              [FormationController::class, 'inscrire']);
    Route::put('/formations/{id}/employes/{eid}',         [FormationController::class, 'updateInscription']);
    Route::delete('/formations/{id}/employes/{eid}',      [FormationController::class, 'desinscrire']);
    Route::get('/employes/{id}/formations',               [FormationController::class, 'formationsEmploye']);

    Route::get('/formations/{id}/evaluations',            [EvaluationFormationController::class, 'index']);
    Route::post('/formations/{id}/evaluations',           [EvaluationFormationController::class, 'store']);
    Route::put('/evaluations/{id}',                       [EvaluationFormationController::class, 'update']);
    Route::delete('/evaluations/{id}',                    [EvaluationFormationController::class, 'destroy']);

    Route::get('/cours',        [CoursController::class, 'index']);
    Route::post('/cours',       [CoursController::class, 'store']);
    Route::post('/cours/bulk-sync', [CoursController::class, 'bulkSync']);
    Route::post('/suivi-formation/bulk-sync', [SuiviFormationController::class, 'bulkSync']);
    Route::get('/cours/{id}',   [CoursController::class, 'show']);
    Route::put('/cours/{id}',   [CoursController::class, 'update']);
    Route::delete('/cours/{id}',[CoursController::class, 'destroy']);

    Route::get('/dashboard/formations-stats',             [DashboardController::class, 'formationsStats']);
    Route::get('/dashboard/pyramide-ages',                [DashboardController::class, 'pyramideAges']);
    Route::get('/dashboard/anciennete',                   [DashboardController::class, 'anciennete']);
    Route::get('/rapport-activite',                       [RapportActiviteController::class, 'stats']);
    Route::get('/rapport-activite/sheets',                 [RapportActiviteController::class, 'sheets']);
    Route::get('/rapport-activite/export',                 [RapportActiviteController::class, 'export']);
});
