<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PlanFormation extends Model
{
    protected $table = 'plan_formation';

    protected $fillable = [
        'annee',
        'titre',
        'description',
        'budget_total',
        'statut',
    ];

    protected $casts = [
        'budget_total' => 'decimal:2',
        'annee'        => 'integer',
    ];

    public function formations(): HasMany
    {
        return $this->hasMany(Formation::class, 'plan_formation_id');
    }
}
