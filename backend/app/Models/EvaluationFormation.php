<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EvaluationFormation extends Model
{
    protected $table = 'evaluation_formation';

    protected $fillable = [
        'formation_id',
        'employe_id',
        'type',
        'note',
        'commentaire',
        'efficace',
        'date_eval',
    ];

    protected $casts = [
        'note'      => 'integer',
        'efficace'  => 'boolean',
        'date_eval' => 'date',
    ];

    public function formation(): BelongsTo
    {
        return $this->belongsTo(Formation::class, 'formation_id');
    }

    public function employe(): BelongsTo
    {
        return $this->belongsTo(Employe::class, 'employe_id');
    }
}
