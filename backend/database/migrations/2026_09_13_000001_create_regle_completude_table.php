<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('regle_completude', function (Blueprint $table) {
            $table->id();
            $table->string('champ', 100);
            $table->string('libelle', 150);
            $table->string('categorie', 100)->nullable();
            $table->boolean('obligatoire')->default(true);
            $table->unsignedSmallInteger('poids')->default(1);
            $table->boolean('actif')->default(true);
            $table->timestamps();
        });

        $now = now();

        $regles = [
            ['champ' => 'fonction',       'libelle' => 'Fonction manquante'],
            ['champ' => 'service_id',     'libelle' => 'Service manquant'],
            ['champ' => 'entite',         'libelle' => 'Entité manquante'],
            ['champ' => 'date_embauche',  'libelle' => "Date d'embauche manquante"],
            ['champ' => 'categorie',      'libelle' => 'Catégorie manquante'],
            ['champ' => 'echelle',        'libelle' => 'Échelle manquante'],
            ['champ' => 'echelon',        'libelle' => 'Échelon manquant'],
            ['champ' => 'date_naissance', 'libelle' => 'Date de naissance manquante'],
        ];

        DB::table('regle_completude')->insert(array_map(fn ($regle) => $regle + [
            'categorie' => null,
            'obligatoire' => true,
            'poids' => 1,
            'actif' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ], $regles));
    }

    public function down(): void
    {
        Schema::dropIfExists('regle_completude');
    }
};
