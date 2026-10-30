<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Reclamation extends Model
{
    protected $table = 'reclamation';

    public const ETATS = [
        'nouvelle' => 'Nouvelle',
        'en_cours' => 'En cours',
        'resolue' => 'Résolue',
        'rejetee' => 'Rejetée',
    ];

    protected $fillable = [
        'numero',
        'date_reception',
        'matricule',
        'nom_complet',
        'type',
        'description',
        'canal',
        'date_reponse_1',
        'contenu_reponse_1',
        'date_reponse_2',
        'contenu_reponse_2',
        'date_solution',
        'etat',
        'remarques',
    ];

    protected $casts = [
        'date_reception' => 'date:Y-m-d',
        'date_reponse_1' => 'date:Y-m-d',
        'date_reponse_2' => 'date:Y-m-d',
        'date_solution' => 'date:Y-m-d',
    ];
}
