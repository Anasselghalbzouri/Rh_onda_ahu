<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Table already exists with id (int) and login — just add password
        Schema::table('responsable_rh', function (Blueprint $table) {
            $table->string('password')->after('login');
        });
    }

    public function down(): void
    {
        Schema::table('responsable_rh', function (Blueprint $table) {
            $table->dropColumn('password');
        });
    }
};
