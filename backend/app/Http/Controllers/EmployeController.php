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

        if ($serviceId = $request->query('service_id')) {
            $query->where('service_id', $serviceId);
        }

        $perPage  = min((int) $request->query('per_page', 15), 200);
        $employes = $query->orderBy('nom')->paginate($perPage);

        return response()->json($employes);
    }

    public function show(string $id): JsonResponse
    {
        $relations = [
            'service',
            'dossierPersonnel',
            'historiqueProfessionnel',
            'demandesConge' => fn ($query) => $query->orderByDesc('date_debut')->orderByDesc('id'),
        ];

        $employe = is_numeric($id)
            ? Employe::with($relations)->findOrFail($id)
            : Employe::with($relations)
                     ->where('matricule', $id)->firstOrFail();

        return response()->json($employe);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'matricule'             => 'required|string|unique:employe,matricule',
            'nom'                   => 'required|string|max:100',
            'prenom'                => 'required|string|max:100',
            'sexe'                  => 'required|in:M,F',
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
            'solde_conge'           => 'nullable|numeric|min:0',
            'statut'                => 'nullable|in:actif,mute,retraite,parti,suspendu',
            'observation'           => 'nullable|string',
        ]);

        $data['solde_conge'] = $data['solde_conge'] ?? 0;
        $data['statut']      = $data['statut'] ?? 'actif';

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

    // T-060 — RHAHU-89 : bulk upsert depuis Excel VBA
    public function bulkSync(Request $request): JsonResponse
    {
        $data = $request->validate([
            'employes'              => 'required|array|min:1|max:500',
            'employes.*.matricule'  => 'required|string',
            'employes.*.nom'        => 'required|string|max:100',
            'employes.*.prenom'     => 'required|string|max:100',
            'employes.*.sexe'                => 'nullable|in:M,F',
            'employes.*.date_naissance'      => 'nullable|date',
            'employes.*.date_embauche'       => 'nullable|date',
            'employes.*.categorie'           => 'nullable|string|max:50',
            'employes.*.echelle'             => 'nullable|string|max:20',
            'employes.*.echelon'             => 'nullable|string|max:20',
            'employes.*.entite'              => 'nullable|string|max:100',
            'employes.*.fonction'            => 'nullable|string|max:100',
            'employes.*.qualification'       => 'nullable|string|max:100',
            'employes.*.affectation'         => 'nullable|string|max:100',
            'employes.*.date_affectation'    => 'nullable|date',
            'employes.*.solde_conge'         => 'nullable|numeric|min:0',
            'employes.*.statut'              => 'nullable|in:actif,mute,retraite,parti,suspendu',
            'employes.*.observation'         => 'nullable|string',
        ]);

        $results  = [];
        $created  = 0;
        $updated  = 0;

        $syncFields = [
            'nom', 'prenom', 'sexe', 'date_naissance', 'date_embauche',
            'categorie', 'echelle', 'echelon', 'entite', 'fonction',
            'qualification', 'affectation', 'date_affectation',
            'solde_conge', 'statut', 'observation',
        ];

        foreach ($data['employes'] as $row) {
            $fields = array_intersect_key($row, array_flip($syncFields));
            
            $fields['solde_conge'] = $fields['solde_conge'] ?? 0;
            $fields['statut']      = $fields['statut'] ?? 'actif';

            $employe = Employe::updateOrCreate(
                ['matricule' => $row['matricule']],
                $fields
            );

            $status = $employe->wasRecentlyCreated ? 'created' : 'updated';
            $employe->wasRecentlyCreated ? $created++ : $updated++;

            $results[] = ['matricule' => $row['matricule'], 'status' => $status];
        }

        return response()->json([
            'total'   => count($data['employes']),
            'created' => $created,
            'updated' => $updated,
            'errors'  => 0,
            'results' => $results,
        ]);
    }
}
