<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pieces_jointes', function (Blueprint $table) {
            $table->date('date_expiration')->nullable()->after('date_upload');
            $table->string('statut', 50)->nullable()->after('date_expiration');
            $table->boolean('obligatoire')->default(false)->after('statut');
            $table->unsignedBigInteger('supprime_par')->nullable()->after('obligatoire');
        });
    }

    public function down(): void
    {
        Schema::table('pieces_jointes', function (Blueprint $table) {
            $table->dropColumn(['date_expiration', 'statut', 'obligatoire', 'supprime_par']);
        });
    }
};
