<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

abstract class Controller
{
    /**
     * Rôle de l'utilisateur authentifié. Aujourd'hui seul le guard RH existe ;
     * cette lecture reste compatible avec un futur attribut de rôle (Employé/DG).
     */
    protected function estRole(Request $request, string $role): bool
    {
        return ($request->user()?->role ?? 'rh') === $role;
    }
}
