<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Comme pour responsable_rh : cette table existait déjà (créée hors
        // migration, en base MySQL historique) mais jamais sur une base
        // SQLite neuve (prod). On ne recrée que si absente ; les migrations
        // suivantes ajoutent ensuite les colonnes récentes (date_expiration,
        // statut, obligatoire, supprime_par). Schéma repris tel quel depuis
        // `SHOW CREATE TABLE pieces_jointes` sur la base MySQL de référence.
        if (! Schema::hasTable('pieces_jointes')) {
            Schema::create('pieces_jointes', function (Blueprint $table) {
                $table->id();
                $table->string('entite');
                $table->unsignedBigInteger('entite_id');
                $table->string('nom_original');
                $table->string('nom_stockage');
                $table->string('chemin', 500)->nullable();
                $table->string('extension');
                $table->unsignedBigInteger('taille_octets');
                $table->string('mime_type');
                $table->string('categorie')->nullable();
                $table->string('description')->nullable();
                $table->unsignedBigInteger('uploade_par')->nullable();
                $table->dateTime('date_upload');
                $table->boolean('actif')->default(true);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('pieces_jointes');
    }
};
