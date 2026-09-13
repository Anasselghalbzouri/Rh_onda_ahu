<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ImportRapport extends Model
{
    protected $table = 'import_rapport';

    public const UPDATED_AT = null;

    protected $fillable = [
        'origine',
        'nom_fichier',
        'total_lignes',
        'lignes_acceptees',
        'lignes_rejetees',
        'execute_par',
    ];

    protected $casts = [
        'total_lignes' => 'integer',
        'lignes_acceptees' => 'integer',
        'lignes_rejetees' => 'integer',
        'created_at' => 'datetime',
    ];

    public function lignes(): HasMany
    {
        return $this->hasMany(ImportRapportLigne::class, 'import_rapport_id');
    }
}
