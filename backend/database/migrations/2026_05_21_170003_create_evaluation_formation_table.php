<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('evaluation_formation', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('formation_id');
            $table->foreign('formation_id')->references('id')->on('formation')->cascadeOnDelete();
            $table->unsignedBigInteger('employe_id');
            $table->foreign('employe_id')->references('id')->on('employe')->cascadeOnDelete();
            $table->unsignedTinyInteger('note')->nullable();
            $table->text('commentaire')->nullable();
            $table->date('date_evaluation');
            $table->timestamps();

            $table->unique(['formation_id', 'employe_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('evaluation_formation');
    }
};
