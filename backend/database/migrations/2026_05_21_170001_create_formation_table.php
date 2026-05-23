<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('formation', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('plan_formation_id')->nullable();
            $table->foreign('plan_formation_id')->references('id')->on('plan_formation')->nullOnDelete();
            $table->string('intitule', 200);
            $table->string('type', 20)->default('interne'); // interne | externe
            $table->string('organisme', 200)->nullable();
            $table->date('date_debut');
            $table->date('date_fin');
            $table->unsignedSmallInteger('duree_jours')->nullable();
            $table->string('lieu', 200)->nullable();
            $table->decimal('cout', 12, 2)->nullable();
            $table->string('statut', 20)->default('planifiee'); // planifiee | en_cours | terminee | annulee
            $table->text('objectifs')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('formation');
    }
};
