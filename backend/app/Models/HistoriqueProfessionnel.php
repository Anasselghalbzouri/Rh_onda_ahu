<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HistoriqueProfessionnel extends Model
{
    protected $table = 'historique_professionnel';

    public $timestamps = false;

    protected $fillable = [
        'employe_id',
        'poste',
        'service',
        'categorie',
        'date_debut',
        'date_fin',
    ];

    protected $casts = [
        'date_debut' => 'date',
        'date_fin'   => 'date',
    ];

    public function employe(): BelongsTo
    {
        return $this->belongsTo(Employe::class, 'employe_id');
    }

    public function isCourant(): bool
    {
        return $this->date_fin === null;
    }

    public function getDureeAttribute(): ?int
    {
        $fin = $this->date_fin ?? now();
        return (int) $this->date_debut->diffInMonths($fin);
    }
}
