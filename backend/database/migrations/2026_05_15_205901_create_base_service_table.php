<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Table historique jamais créée par une migration (voir
        // docs/INCIDENT_DEPLOIEMENT_2026-09-12.md, cause racine n°3) : elle
        // existe déjà sur les environnements où elle a été créée à la main.
        // Sur une base neuve, on la crée avec le schéma attendu par
        // App\Models\Service et par employe.service_id.
        if (! Schema::hasTable('service')) {
            Schema::create('service', function (Blueprint $table) {
                $table->id();
                $table->string('nom')->unique();
                $table->string('description')->nullable();
                $table->string('domaine')->nullable();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('service');
    }
};
