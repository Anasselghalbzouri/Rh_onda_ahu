<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Absence extends Model
{
    protected $table = 'absence';

    public $timestamps = false;

    protected $fillable = [
        'employe_id',
        'type',
        'date',
        'duree',
        'justifiee',
        'motif',
    ];

    protected $casts = [
        'date'      => 'date',
        'duree'     => 'decimal:2',
        'justifiee' => 'boolean',
    ];

    public function employe(): BelongsTo
    {
        return $this->belongsTo(Employe::class, 'employe_id');
    }

    public function isInjustifiee(): bool
    {
        return ! $this->justifiee;
    }
}
