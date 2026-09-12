<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Sur les bases où la table existe déjà (créée hors migration, en
        // local), on ne fait rien : les migrations suivantes se chargent
        // d'y ajouter password/nom/prenom. Sur une base neuve (prod), on
        // crée la table de base attendue par ces migrations.
        if (! Schema::hasTable('responsable_rh')) {
            Schema::create('responsable_rh', function (Blueprint $table) {
                $table->id();
                $table->string('login')->unique();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('responsable_rh');
    }
};
