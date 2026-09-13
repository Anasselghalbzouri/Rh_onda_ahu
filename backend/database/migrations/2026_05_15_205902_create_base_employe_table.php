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
        // existe déjà sur les environnements où elle a été créée à la main
        // (129 employés en prod). Sur une base neuve (dev local, CI), elle
        // n'existe pas encore et fait planter toute migration ultérieure qui
        // la référence (demande_conge, formation_employe, ...) — ce schéma
        // reprend exactement les colonnes de App\Models\Employe::$fillable.
        if (! Schema::hasTable('employe')) {
            Schema::create('employe', function (Blueprint $table) {
                $table->id();
                $table->string('matricule')->unique();
                $table->string('nom')->nullable();
                $table->string('prenom')->nullable();
                $table->string('sexe', 1)->nullable();
                $table->date('date_naissance')->nullable();
                $table->date('date_embauche')->nullable();
                $table->string('categorie')->nullable();
                $table->string('echelle')->nullable();
                $table->string('echelon')->nullable();
                $table->string('entite')->nullable();
                $table->string('fonction')->nullable();
                $table->string('qualification')->nullable();
                $table->unsignedBigInteger('service_id')->nullable();
                $table->string('affectation')->nullable();
                $table->date('date_affectation')->nullable();
                $table->string('mutation')->nullable();
                $table->date('date_mutation')->nullable();
                $table->boolean('retraite')->default(false);
                $table->date('date_retraite')->nullable();
                $table->boolean('depart_volontaire')->default(false);
                $table->date('date_depart_volontaire')->nullable();
                $table->text('observation')->nullable();
                $table->float('solde_conge')->default(0);
                $table->string('statut')->default('actif');

                $table->foreign('service_id')->references('id')->on('service')->onDelete('set null');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('employe');
    }
};
