<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('formation', function (Blueprint $table) {
            // cours_id already exists in this DB — skip
            if (!Schema::hasColumn('formation', 'cours_id')) {
                $table->unsignedBigInteger('cours_id')->nullable()->after('plan_formation_id');
                $table->foreign('cours_id')->references('id')->on('cours')->nullOnDelete();
            }
            if (!Schema::hasColumn('formation', 'mois_prevu')) {
                $table->tinyInteger('mois_prevu')->unsigned()->nullable()->after('lieu');
            }
            if (!Schema::hasColumn('formation', 'observations')) {
                $table->text('observations')->nullable()->after('mois_prevu');
            }
        });
    }

    public function down(): void
    {
        Schema::table('formation', function (Blueprint $table) {
            if (Schema::hasColumn('formation', 'observations')) {
                $table->dropColumn('observations');
            }
            if (Schema::hasColumn('formation', 'mois_prevu')) {
                $table->dropColumn('mois_prevu');
            }
        });
    }
};
