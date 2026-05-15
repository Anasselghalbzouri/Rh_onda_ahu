<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class PieceJointe extends Model
{
    protected $table = 'pieces_jointes';

    public $timestamps = false;

    protected $fillable = [
        'entite',
        'entite_id',
        'nom_original',
        'nom_stockage',
        'chemin',
        'extension',
        'taille_octets',
        'mime_type',
        'categorie',
        'uploade_par',
        'date_upload',
        'description',
        'actif',
    ];

    protected $casts = [
        'date_upload'   => 'datetime',
        'taille_octets' => 'integer',
        'actif'         => 'boolean',
    ];

    // Entités supportées → modèle correspondant
    private const ENTITE_MAP = [
        'employe'                  => Employe::class,
        'dossier_personnel'        => DossierPersonnel::class,
        'demande_conge'            => DemandeConge::class,
        'absence'                  => Absence::class,
        'historique_professionnel' => HistoriqueProfessionnel::class,
    ];

    public function uploadePar(): BelongsTo
    {
        return $this->belongsTo(ResponsableRh::class, 'uploade_par');
    }

    public function getTailleHumaineAttribute(): string
    {
        $kb = $this->taille_octets / 1024;
        if ($kb < 1024) return round($kb, 1).' Ko';
        return round($kb / 1024, 1).' Mo';
    }

    public function getUrlAttribute(): string
    {
        return Storage::url($this->chemin);
    }

    // Scope pour filtrer par entité
    public function scopePourEntite($query, string $entite, int $id)
    {
        return $query->where('entite', $entite)->where('entite_id', $id)->where('actif', true);
    }
}
