<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Service extends Model
{
    protected $table = 'service';

    public $timestamps = false;

    protected $fillable = [
        'nom',
        'description',
        'domaine',
    ];

    public function employes(): HasMany
    {
        return $this->hasMany(Employe::class, 'service_id');
    }
}
