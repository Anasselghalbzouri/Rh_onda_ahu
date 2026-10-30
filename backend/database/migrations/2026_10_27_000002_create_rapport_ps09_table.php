<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Saisies manuelles du rapport PS09 ; trimestre 0 = données annuelles (stages, polyvalence).
        Schema::create('rapport_ps09', function (Blueprint $table) {
            $table->id();
            $table->unsignedSmallInteger('annee');
            $table->unsignedTinyInteger('trimestre');
            $table->json('donnees');
            $table->timestamp('updated_at')->nullable();
            $table->unique(['annee', 'trimestre']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rapport_ps09');
    }
};
