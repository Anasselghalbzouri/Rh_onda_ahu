<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DemandeConge extends Model
{
    protected $table = 'demande_conge';

    public $timestamps = false;

    protected $fillable = [
        'employe_id',
        'rh_id',
        'type_conge',
        'date_debut',
        'date_fin',
        'nombre_jours',
        'solde_restant',
        'motif',
        'statut',
        'date_decision',
        'commentaire_rh',
        'ref_hraccess',
        'ref_onda_ahu',
        'fichier_nom',
        'fichier_chemin',
    ];

    protected $casts = [
        'date_debut'    => 'date',
        'date_fin'      => 'date',
        'date_decision' => 'date',
    ];

    public function employe(): BelongsTo
    {
        return $this->belongsTo(Employe::class, 'employe_id');
    }

    public function responsableRh(): BelongsTo
    {
        return $this->belongsTo(ResponsableRh::class, 'rh_id');
    }

    public function isEnAttente(): bool
    {
        return $this->statut === 'en_attente';
    }

    public function isApprouve(): bool
    {
        return $this->statut === 'approuve';
    }
}
