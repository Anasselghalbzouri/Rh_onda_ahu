<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Cours extends Model
{
    protected $table = 'cours';

    protected $fillable = [
        'theme',
        'description',
        'duree_jours',
    ];

    protected $casts = [
        'duree_jours' => 'integer',
    ];

    public function formations(): HasMany
    {
        return $this->hasMany(Formation::class, 'cours_id');
    }
}
