<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RegleCompletude extends Model
{
    protected $table = 'regle_completude';

    protected $fillable = [
        'champ',
        'libelle',
        'categorie',
        'obligatoire',
        'poids',
        'actif',
    ];

    protected $casts = [
        'obligatoire' => 'boolean',
        'actif' => 'boolean',
        'poids' => 'integer',
    ];
}
