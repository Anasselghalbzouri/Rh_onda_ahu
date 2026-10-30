<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RapportPs09 extends Model
{
    protected $table = 'rapport_ps09';

    const CREATED_AT = null;

    protected $fillable = ['annee', 'trimestre', 'donnees'];

    protected $casts = [
        'donnees' => 'array',
    ];
}
