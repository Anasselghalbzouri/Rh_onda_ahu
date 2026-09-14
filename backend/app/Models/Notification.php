<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    protected $table = 'notification';

    public $timestamps = false; // seulement created_at (rempli par la DB)

    protected $fillable = [
        'type',
        'titre',
        'message',
        'data',
        'lu',
    ];

    protected $casts = [
        'data' => 'array',
        'lu' => 'boolean',
        'created_at' => 'datetime',
    ];

    /**
     * Enregistre une notification de synchronisation Excel.
     *
     * Appelé depuis EmployeController@bulkSync et ImportController@importFromFile.
     * Ne crée rien si aucun changement réel (created + modified == 0) — évite le
     * bruit sur les enregistrements Excel sans modification de données.
     */
    public static function recordExcelSync(int $created, int $modified, string $source, int $deleted = 0): ?self
    {
        if ($created === 0 && $modified === 0 && $deleted === 0) {
            return null;
        }

        $parts = [];
        if ($created > 0) {
            $parts[] = $created.' '.($created > 1 ? 'nouveaux employés' : 'nouvel employé');
        }
        if ($modified > 0) {
            $parts[] = $modified.' '.($modified > 1 ? 'employés modifiés' : 'employé modifié');
        }
        if ($deleted > 0) {
            $parts[] = $deleted.' '.($deleted > 1 ? 'employés supprimés' : 'employé supprimé');
        }

        return self::create([
            'type' => 'sync_excel',
            'titre' => 'Fichier Excel synchronisé',
            'message' => ucfirst(implode(' · ', $parts)).'.',
            'data' => [
                'created' => $created,
                'modified' => $modified,
                'deleted' => $deleted,
                'total' => $created + $modified,
                'source' => $source,
            ],
            'lu' => false,
        ]);
    }
}
