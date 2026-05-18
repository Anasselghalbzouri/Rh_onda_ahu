<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('responsable_rh', function (Blueprint $table) {
            $table->string('prenom')->nullable()->after('login');
            $table->string('nom')->nullable()->after('prenom');
        });
    }

    public function down(): void
    {
        Schema::table('responsable_rh', function (Blueprint $table) {
            $table->dropColumn(['prenom', 'nom']);
        });
    }
};
