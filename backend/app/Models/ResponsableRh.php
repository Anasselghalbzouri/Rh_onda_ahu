<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;

class ResponsableRh extends Employe
{
    protected $table = 'responsable_rh';

    public $timestamps = false;

    protected $fillable = [
        'login',
    ];

    // Les colonnes propres à responsable_rh uniquement
    // Les colonnes d'employe ne sont pas dupliquées ici car la table
    // responsable_rh ne les contient pas (relation par login, pas héritage DB)

    public function demandesTraitees(): HasMany
    {
        return $this->hasMany(DemandeConge::class, 'rh_id');
    }
}
