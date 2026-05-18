<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\EmployeController;
use App\Http\Controllers\ImportController;
use App\Http\Controllers\PieceJointeController;
use Illuminate\Support\Facades\Route;

// Public
Route::post('/login', [AuthController::class, 'login']);

// Protected — RH only
Route::middleware('auth:rh')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);
    Route::put('/change-password', [AuthController::class, 'changePassword']);
    Route::post('/sync-employes', [ImportController::class, 'syncFromExcel']);

    // T-08 — CRUD Employés
    Route::get('/employes', [EmployeController::class, 'index']);
    Route::post('/employes', [EmployeController::class, 'store']);
    Route::get('/employes/{id}', [EmployeController::class, 'show']);
    Route::put('/employes/{id}', [EmployeController::class, 'update']);
    Route::delete('/employes/{id}', [EmployeController::class, 'destroy']);

    // T-09 — Pièces Jointes
    Route::get('/employes/{id}/pieces-jointes', [PieceJointeController::class, 'index']);
    Route::post('/employes/{id}/pieces-jointes', [PieceJointeController::class, 'store']);
    Route::delete('/pieces-jointes/{id}', [PieceJointeController::class, 'destroy']);
});
