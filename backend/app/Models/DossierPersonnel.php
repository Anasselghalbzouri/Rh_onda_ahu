<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DossierPersonnel extends Model
{
    protected $table = 'dossier_personnel';

    public $timestamps = false;

    protected $fillable = [
        'employe_id',
        'type_piece',
        'date_expiration',
        'statut',
    ];

    protected $casts = [
        'date_expiration' => 'date',
    ];

    public function employe(): BelongsTo
    {
        return $this->belongsTo(Employe::class, 'employe_id');
    }

    public function piecesJointes(): HasMany
    {
        return $this->hasMany(PieceJointe::class, 'entite_id')
                    ->where('entite', 'dossier_personnel');
    }

    public function isExpire(): bool
    {
        return $this->statut === 'expire'
            || ($this->date_expiration && $this->date_expiration->isPast());
    }
}
