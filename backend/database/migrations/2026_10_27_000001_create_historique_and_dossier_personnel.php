<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const COLONNES_HISTORIQUE = [
        'poste' => 'string',
        'service' => 'string',
        'categorie' => 'string',
        'echelle' => 'string',
        'date_debut' => 'date',
        'date_fin' => 'date',
    ];

    public function up(): void
    {
        // Tables jamais créées par une migration (créées à la main en prod) : sans
        // elles, toute fiche employé échoue sur une base neuve (spec 004, US1).
        if (! Schema::hasTable('historique_professionnel')) {
            Schema::create('historique_professionnel', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('employe_id');
                foreach (self::COLONNES_HISTORIQUE as $nom => $type) {
                    $table->{$type}($nom)->nullable();
                }
                $table->foreign('employe_id')->references('id')->on('employe')->onDelete('cascade');
            });
        } else {
            // Schéma prod non confirmé : on n'ajoute que les colonnes manquantes,
            // sans toucher aux colonnes ni aux lignes existantes.
            foreach (self::COLONNES_HISTORIQUE as $nom => $type) {
                if (! Schema::hasColumn('historique_professionnel', $nom)) {
                    Schema::table('historique_professionnel', fn (Blueprint $table) => $table->{$type}($nom)->nullable());
                }
            }
        }

        if (! Schema::hasTable('dossier_personnel')) {
            Schema::create('dossier_personnel', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('employe_id');
                $table->string('type_piece');
                $table->date('date_expiration')->nullable();
                $table->string('statut')->nullable();
                $table->foreign('employe_id')->references('id')->on('employe')->onDelete('cascade');
            });
        }

        // Point de départ (US3) : une période en cours par employé actif/muté sans
        // historique ; rejouable sans doublon.
        DB::table('employe')
            ->whereIn('statut', ['actif', 'mute'])
            ->whereNotExists(fn ($q) => $q->from('historique_professionnel')
                ->whereColumn('historique_professionnel.employe_id', 'employe.id'))
            ->get()
            ->each(fn ($e) => DB::table('historique_professionnel')->insert([
                'employe_id' => $e->id,
                'poste' => $e->fonction,
                'service' => $e->entite,
                'categorie' => $e->categorie,
                'echelle' => $e->echelle,
                'date_debut' => $e->date_affectation ?? $e->date_embauche,
                'date_fin' => null,
            ]));
    }

    public function down(): void
    {
        // Rien : ces tables peuvent exister avant cette migration (données prod).
    }
};
