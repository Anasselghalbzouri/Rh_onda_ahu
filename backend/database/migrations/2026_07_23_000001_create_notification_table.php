<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notification', function (Blueprint $table) {
            $table->id();
            $table->string('type', 50)->default('info');   // ex. sync_excel
            $table->string('titre', 150);
            $table->text('message');
            $table->json('data')->nullable();               // ex. {created, modified, total, source}
            // État de lecture global (petite équipe RH partageant les mêmes
            // notifications système). Pas de user_id : voir NotificationController.
            $table->boolean('lu')->default(false);
            $table->timestamp('created_at')->useCurrent();

            $table->index(['lu', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notification');
    }
};
