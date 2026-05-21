<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('demande_conge', function (Blueprint $table) {
            if (!Schema::hasColumn('demande_conge', 'ref_hraccess')) {
                $table->string('ref_hraccess', 100)->nullable()->after('commentaire_rh');
            }
            if (!Schema::hasColumn('demande_conge', 'ref_onda_ahu')) {
                $table->string('ref_onda_ahu', 100)->nullable()->after('ref_hraccess');
            }
            if (!Schema::hasColumn('demande_conge', 'fichier_nom')) {
                $table->string('fichier_nom', 255)->nullable()->after('ref_onda_ahu');
            }
            if (!Schema::hasColumn('demande_conge', 'fichier_chemin')) {
                $table->string('fichier_chemin', 500)->nullable()->after('fichier_nom');
            }
        });
    }

    public function down(): void
    {
        Schema::table('demande_conge', function (Blueprint $table) {
            $table->dropColumn(['ref_hraccess', 'ref_onda_ahu', 'fichier_nom', 'fichier_chemin']);
        });
    }
};
