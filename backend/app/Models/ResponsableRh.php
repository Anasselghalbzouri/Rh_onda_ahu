<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class ResponsableRh extends Authenticatable
{
    use HasApiTokens;

    protected $table = 'responsable_rh';

    public $timestamps = false;

    protected $fillable = ['id', 'login', 'password'];

    protected $hidden = ['password'];

    public function demandesTraitees(): HasMany
    {
        return $this->hasMany(DemandeConge::class, 'rh_id');
    }
}
