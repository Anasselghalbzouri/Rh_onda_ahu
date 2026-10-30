<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Pas de clé étrangère vers employe : le matricule et le nom sont copiés pour
        // survivre à la suppression d'un employé (synchronisation Excel complète).
        Schema::create('reclamation', function (Blueprint $table) {
            $table->id();
            $table->string('numero')->unique();
            $table->date('date_reception');
            $table->string('matricule')->index();
            $table->string('nom_complet');
            $table->string('type');
            $table->text('description');
            $table->string('canal');
            $table->date('date_reponse_1')->nullable();
            $table->text('contenu_reponse_1')->nullable();
            $table->date('date_reponse_2')->nullable();
            $table->text('contenu_reponse_2')->nullable();
            $table->date('date_solution')->nullable();
            $table->string('etat')->default('nouvelle')->index();
            $table->text('remarques')->nullable();
            $table->timestamps();
        });

        // Compteur par année : un numéro supprimé n'est jamais réattribué.
        Schema::create('reclamation_compteur', function (Blueprint $table) {
            $table->unsignedSmallInteger('annee')->primary();
            $table->unsignedInteger('dernier')->default(0);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reclamation_compteur');
        Schema::dropIfExists('reclamation');
    }
};
