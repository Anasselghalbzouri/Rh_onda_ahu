<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('import_rapport', function (Blueprint $table) {
            $table->id();
            $table->string('origine', 30);
            $table->string('nom_fichier', 255)->nullable();
            $table->unsignedInteger('total_lignes')->default(0);
            $table->unsignedInteger('lignes_acceptees')->default(0);
            $table->unsignedInteger('lignes_rejetees')->default(0);
            $table->unsignedBigInteger('execute_par')->nullable();
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('import_rapport_ligne', function (Blueprint $table) {
            $table->id();
            $table->foreignId('import_rapport_id')->constrained('import_rapport')->cascadeOnDelete();
            $table->unsignedInteger('numero_ligne');
            $table->string('matricule', 50)->nullable();
            $table->string('motif', 500);
            $table->timestamp('created_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('import_rapport_ligne');
        Schema::dropIfExists('import_rapport');
    }
};
