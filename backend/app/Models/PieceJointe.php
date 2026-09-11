<?php

namespace App\Models;

use App\Support\DocumentsEmployesReference;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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
        'date_expiration',
        'statut',
        'obligatoire',
        'supprime_par',
    ];

    protected $casts = [
        'date_upload' => 'datetime',
        'taille_octets' => 'integer',
        'actif' => 'boolean',
        'date_expiration' => 'date',
        'obligatoire' => 'boolean',
    ];

    // Entités supportées → modèle correspondant
    private const ENTITE_MAP = [
        'employe' => Employe::class,
        'dossier_personnel' => DossierPersonnel::class,
        'demande_conge' => DemandeConge::class,
        'absence' => Absence::class,
        'historique_professionnel' => HistoriqueProfessionnel::class,
    ];

    public function uploadePar(): BelongsTo
    {
        return $this->belongsTo(ResponsableRh::class, 'uploade_par');
    }

    public function supprimePar(): BelongsTo
    {
        return $this->belongsTo(ResponsableRh::class, 'supprime_par');
    }

    /** Relation logique valide uniquement lorsque `entite = 'employe'`. */
    public function employe(): BelongsTo
    {
        return $this->belongsTo(Employe::class, 'entite_id');
    }

    /**
     * Règle de dérivation du statut (data-model.md) :
     * date_expiration dépassée → « expire » ; dans les 30 jours → « a_renouveler » ;
     * sinon → « valide » (ou la valeur manuelle du RH pour un document non daté).
     */
    public function statutCalcule(): string
    {
        if ($this->date_expiration) {
            $expiration = $this->date_expiration->copy()->startOfDay();

            if ($expiration->isPast()) {
                return 'expire';
            }

            if ($expiration->lte(now()->addDays(DocumentsEmployesReference::DELAI_RENOUVELLEMENT_JOURS)->endOfDay())) {
                return 'a_renouveler';
            }

            return 'valide';
        }

        return $this->statut ?: 'valide';
    }

    public function getTailleHumaineAttribute(): string
    {
        $kb = $this->taille_octets / 1024;
        if ($kb < 1024) {
            return round($kb, 1).' Ko';
        }

        return round($kb / 1024, 1).' Mo';
    }

    // Scope pour filtrer par entité
    public function scopePourEntite($query, string $entite, int $id)
    {
        return $query->where('entite', $entite)->where('entite_id', $id)->where('actif', true);
    }
}
