<?php

namespace App\Http\Controllers;

use App\Exports\EmployeExport;
use App\Models\Employe;
use App\Models\Notification;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class EmployeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage  = min((int) $request->query('per_page', 15), 200);
        $employes = $this->filtered($request)->paginate($perPage);

        return response()->json($employes);
    }

    /**
     * Export Excel des employés — applique les mêmes filtres que la liste
     * (recherche / statut / service) pour coller à ce que l'utilisateur voit.
     */
    public function export(Request $request): StreamedResponse
    {
        $employes = $this->filtered($request)->get();

        return (new EmployeExport($employes))->download();
    }

    /** Construit la requête filtrée partagée par index() et export(). */
    private function filtered(Request $request): Builder
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

        return $query->orderBy('nom');
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
        $modified = 0;
        $unchanged = 0;

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

            // wasChanged() ne compte que les vraies modifications de champs :
            // un ré-enregistrement Excel sans changement de données n'est pas
            // compté (voir Notification::recordExcelSync).
            if ($employe->wasRecentlyCreated) {
                $status = 'created';
                $created++;
            } elseif ($employe->wasChanged()) {
                $status = 'modified';
                $modified++;
            } else {
                $status = 'unchanged';
                $unchanged++;
            }

            $results[] = ['matricule' => $row['matricule'], 'status' => $status];
        }

        // Notification uniquement s'il y a eu un vrai changement.
        Notification::recordExcelSync($created, $modified, 'bulk-sync');

        return response()->json([
            'total'     => count($data['employes']),
            'created'   => $created,
            'updated'   => $modified,   // rétro-compatibilité : "updated" = modifiés réels
            'modified'  => $modified,
            'unchanged' => $unchanged,
            'errors'    => 0,
            'results'   => $results,
        ]);
    }
}
