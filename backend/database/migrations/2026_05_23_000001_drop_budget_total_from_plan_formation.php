<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('plan_formation', 'budget_total')) {
            Schema::table('plan_formation', function (Blueprint $table) {
                $table->dropColumn('budget_total');
            });
        }
    }

    public function down(): void
    {
        Schema::table('plan_formation', function (Blueprint $table) {
            $table->decimal('budget_total', 12, 2)->nullable()->after('description');
        });
    }
};
