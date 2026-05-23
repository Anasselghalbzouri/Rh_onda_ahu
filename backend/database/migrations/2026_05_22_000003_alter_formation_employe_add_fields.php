<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employe_formation', function (Blueprint $table) {
            if (!Schema::hasColumn('employe_formation', 'statut')) {
                $table->string('statut', 20)->default('inscrit')->after('formation_id');
            }
            if (!Schema::hasColumn('employe_formation', 'suivi')) {
                $table->boolean('suivi')->default(false);
            }
            if (!Schema::hasColumn('employe_formation', 'remarque')) {
                $table->text('remarque')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('employe_formation', function (Blueprint $table) {
            $table->dropColumn(array_filter(['statut', 'suivi', 'remarque'], fn($c) => Schema::hasColumn('employe_formation', $c)));
        });
    }
};
