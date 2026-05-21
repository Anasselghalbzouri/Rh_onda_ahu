<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('demande_conge')) {
            return;
        }

        Schema::create('demande_conge', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('employe_id');
            $table->unsignedBigInteger('rh_id')->nullable();
            $table->string('type_conge', 50);          // annuel, maladie, maternite, sans_solde, exceptionnel
            $table->date('date_debut');
            $table->date('date_fin');
            $table->unsignedSmallInteger('nombre_jours');
            $table->float('solde_restant')->nullable();
            $table->text('motif')->nullable();
            $table->string('statut', 20)->default('en_attente'); // en_attente, approuve, refuse
            $table->date('date_decision')->nullable();
            $table->text('commentaire_rh')->nullable();
            $table->timestamps();

            $table->foreign('employe_id')->references('id')->on('employe')->onDelete('cascade');
            $table->foreign('rh_id')->references('id')->on('responsable_rh')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('demande_conge');
    }
};
