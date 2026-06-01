<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plan_formation', function (Blueprint $table) {
            $table->id();
            $table->unsignedSmallInteger('annee');
            $table->string('titre', 200);
            $table->text('description')->nullable();
            $table->decimal('budget_total', 12, 2)->nullable();
            $table->string('statut', 20)->default('draft');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plan_formation');
    }
};
