<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employe', function (Blueprint $table) {
            $table->unsignedTinyInteger('taux_completude')->nullable()->after('statut');
            $table->json('champs_manquants')->nullable()->after('taux_completude');
            $table->timestamp('date_dernier_calcul')->nullable()->after('champs_manquants');
        });
    }

    public function down(): void
    {
        Schema::table('employe', function (Blueprint $table) {
            $table->dropColumn(['taux_completude', 'champs_manquants', 'date_dernier_calcul']);
        });
    }
};
