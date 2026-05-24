<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PlanFormation extends Model
{
    protected $table = 'plan_formation';

    protected $fillable = [
        'annee',
        'statut',
        'titre',
        'description',

    ];

    protected $casts = [
        'annee'        => 'integer',
    ];

    public function formations(): HasMany
    {
        return $this->hasMany(Formation::class, 'plan_formation_id');
    }
}
