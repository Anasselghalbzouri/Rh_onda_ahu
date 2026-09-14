<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * La base MySQL historique porte une contrainte `fk_pj_uploade_par`
     * (pieces_jointes.uploade_par → employe.id) SANS action ON DELETE. MySQL la
     * traite alors comme RESTRICT, ce qui bloque la suppression d'un employé
     * (erreur 1451 : "Cannot delete or update a parent row").
     *
     * On la recrée avec ON DELETE SET NULL (uploade_par est nullable) pour ne
     * plus bloquer la suppression. No-op sur les bases qui n'ont pas la
     * contrainte (bases neuves, SQLite de test).
     */
    public function up(): void
    {
        $this->replaceUploadeParForeignKey('SET NULL');
    }

    public function down(): void
    {
        $this->replaceUploadeParForeignKey('RESTRICT');
    }

    private function replaceUploadeParForeignKey(string $onDelete): void
    {
        // Correction réservée à MySQL : SQLite (tests) n'a pas cette contrainte.
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        if (! $this->hasForeignKey('pieces_jointes', 'fk_pj_uploade_par')) {
            return;
        }

        DB::statement('ALTER TABLE `pieces_jointes` DROP FOREIGN KEY `fk_pj_uploade_par`');

        DB::statement(
            'ALTER TABLE `pieces_jointes` ADD CONSTRAINT `fk_pj_uploade_par` '
            .'FOREIGN KEY (`uploade_par`) REFERENCES `employe` (`id`) '
            ."ON DELETE {$onDelete} ON UPDATE CASCADE"
        );
    }

    private function hasForeignKey(string $table, string $constraint): bool
    {
        foreach (Schema::getForeignKeys($table) as $foreignKey) {
            if (($foreignKey['name'] ?? null) === $constraint) {
                return true;
            }
        }

        return false;
    }
};
