<?php

namespace App\Http\Controllers;

use App\Models\Employe;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmployeController extends Controller
{
    // JsonResponse makes the API contract explicit: this action returns JSON data.
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

    public function show(string $id): JsonResponse
    {
        $employe = is_numeric($id)
            ? Employe::with(['service', 'dossierPersonnel', 'historiqueProfessionnel'])->findOrFail($id)
            : Employe::with(['service', 'dossierPersonnel', 'historiqueProfessionnel'])
                     ->where('matricule', $id)->firstOrFail();

        return response()->json($employe);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'matricule'             => 'required|string|unique:employe,matricule',
            'nom'                   => 'required|string|max:100',
            'prenom'                => 'required|string|max:100',
            'sexe'                  => 'nullable|in:M,F',
            'date_naissance'        => 'nullable|date',
            'date_embauche'         => 'nullable|date',
            'categorie'             => 'nullable|string|max:50',
            'echelle'               => 'nullable|string|max:20',
            'echelon'               => 'nullable|string|max:20',
            'entite'                => 'nullable|string|max:100',
            'fonction'              => 'nullable|string|max:100',
            'qualification'         => 'nullable|string|max:100',
            'service_id'            => 'nullable|integer|exists:service,id',
            'affectation'           => 'nullable|string|max:100',
            'date_affectation'      => 'nullable|date',
            'solde_conge'           => 'nullable|numeric',
            'statut'                => 'nullable|string|max:20',
            'observation'           => 'nullable|string',
        ]);

        $employe = Employe::create($data);

        return response()->json($employe, 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $employe = Employe::findOrFail($id);

        $data = $request->validate([
            'matricule'             => "nullable|string|unique:employe,matricule,{$id}",
            'nom'                   => 'nullable|string|max:100',
            'prenom'                => 'nullable|string|max:100',
            'sexe'                  => 'nullable|in:M,F',
            'date_naissance'        => 'nullable|date',
            'date_embauche'         => 'nullable|date',
            'categorie'             => 'nullable|string|max:50',
            'echelle'               => 'nullable|string|max:20',
            'echelon'               => 'nullable|string|max:20',
            'entite'                => 'nullable|string|max:100',
            'fonction'              => 'nullable|string|max:100',
            'qualification'         => 'nullable|string|max:100',
            'service_id'            => 'nullable|integer|exists:service,id',
            'affectation'           => 'nullable|string|max:100',
            'date_affectation'      => 'nullable|date',
            'solde_conge'           => 'nullable|numeric',
            'statut'                => 'nullable|string|max:20',
            'observation'           => 'nullable|string',
        ]);

        $employe->update($data);

        return response()->json($employe);
    }

    public function destroy(int $id): JsonResponse
    {
        $employe = Employe::findOrFail($id);
        $employe->delete();

        return response()->json(['message' => 'Employé supprimé.']);
    }
}
