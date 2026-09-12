<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * La migration create_formation_employe_table créait la table sous le
     * mauvais nom ('formation_employe' au lieu de 'employe_formation',
     * celui utilisé par les relations belongsToMany des modèles Employe et
     * Formation). Corrigée directement dans ce fichier, mais les
     * environnements où elle a déjà tourné (ex. prod) ont déjà la table
     * sous le mauvais nom et ne rejoueront pas cette migration. On la
     * renomme ici si besoin.
     */
    public function up(): void
    {
        if (Schema::hasTable('formation_employe') && ! Schema::hasTable('employe_formation')) {
            Schema::rename('formation_employe', 'employe_formation');
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('employe_formation') && ! Schema::hasTable('formation_employe')) {
            Schema::rename('employe_formation', 'formation_employe');
        }
    }
};
