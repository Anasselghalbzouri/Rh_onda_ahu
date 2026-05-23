<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Formation extends Model
{
    protected $table = 'formation';

    protected $fillable = [
        'plan_formation_id',
        'cours_id',
        'intitule',
        'type',
        'organisme',
        'date_debut',
        'date_fin',
        'lieu',
        'budget_prevu',
        'niveau',
        'mois_prevu',
        'observations',
    ];

    protected $casts = [
        'date_debut'   => 'date',
        'date_fin'     => 'date',
        'budget_prevu' => 'decimal:2',
        'mois_prevu'   => 'integer',
    ];

    public function planFormation(): BelongsTo
    {
        return $this->belongsTo(PlanFormation::class, 'plan_formation_id');
    }

    public function cours(): BelongsTo
    {
        return $this->belongsTo(Cours::class, 'cours_id');
    }

    public function employes(): BelongsToMany
    {
        return $this->belongsToMany(Employe::class, 'employe_formation', 'formation_id', 'employe_id')
                    ->withPivot('statut', 'suivi', 'remarque');
    }

    public function evaluations(): HasMany
    {
        return $this->hasMany(EvaluationFormation::class, 'formation_id');
    }
}
