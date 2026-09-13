<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ImportRapportLigne extends Model
{
    protected $table = 'import_rapport_ligne';

    public const UPDATED_AT = null;

    protected $fillable = [
        'import_rapport_id',
        'numero_ligne',
        'matricule',
        'motif',
    ];

    protected $casts = [
        'numero_ligne' => 'integer',
        'created_at' => 'datetime',
    ];

    public function rapport(): BelongsTo
    {
        return $this->belongsTo(ImportRapport::class, 'import_rapport_id');
    }
}
