<?php

namespace App\Http\Controllers;

use App\Models\Employe;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmployeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Employe::with('service');

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('nom', 'like', "%{$search}%")
                  ->orWhere('prenom', 'like', "%{$search}%")
                  ->orWhere('matricule', 'like', "%{$search}%")
                  ->orWhere('fonction', 'like', "%{$search}%");
            });
        }

        if ($statut = $request->query('statut')) {
            $query->where('statut', $statut);
        }

        $employes = $query->orderBy('nom')->paginate(15);

        return response()->json($employes);
    }
}
