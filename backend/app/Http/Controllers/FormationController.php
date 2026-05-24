<?php

namespace App\Http\Controllers;

use App\Exports\FormationExport;
use App\Models\Employe;
use App\Models\Formation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class FormationController extends Controller
{
    // ── CRUD Formation ──────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $query = Formation::with('planFormation:id,titre,annee')->withCount('employes');

        if ($request->filled('plan_id')) {
            $query->where('plan_formation_id', $request->plan_id);
        }

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        if ($request->filled('annee')) {
            $query->whereYear('date_debut', $request->annee);
        }

        if ($request->filled('service_id')) {
            $query->whereHas('employes', fn($q) => $q->where('service_id', $request->service_id));
        }

        return response()->json($query->orderByDesc('date_debut')->paginate(15));
    }

    public function show(int $id): JsonResponse
    {
        $formation = Formation::with([
            'planFormation:id,titre,annee',
            'employes:id,matricule,nom,prenom',
            'evaluations.employe:id,matricule,nom,prenom',
        ])->withCount('employes')->findOrFail($id);

        return response()->json($formation);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'plan_formation_id' => 'nullable|exists:plan_formation,id',
            'cours_id'          => 'nullable|exists:cours,id',
            'intitule'          => 'required|string|max:200',
            'type'              => 'nullable|string',
            'organisme'         => 'nullable|string|max:200',
            'date_debut'        => 'required|date',
            'date_fin'          => 'required|date|after_or_equal:date_debut',
            'lieu'         => 'nullable|string|max:200',
            'niveau'       => 'nullable|string',
            // 'mois_prevu'   => 'nullable|integer|between:1,12',
            'observations' => 'nullable|string',
        ]);

        $formation = Formation::create($data);

        return response()->json($formation->load('planFormation:id,titre,annee'), 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $formation = Formation::findOrFail($id);

        $data = $request->validate([
            'plan_formation_id' => 'nullable|exists:plan_formation,id',
            'cours_id'          => 'nullable|exists:cours,id',
            'intitule'          => 'sometimes|string|max:200',
            'type'              => 'nullable|string',
            'organisme'         => 'nullable|string|max:200',
            'date_debut'        => 'sometimes|date',
            'date_fin'          => 'sometimes|date|after_or_equal:date_debut',
            'lieu'         => 'nullable|string|max:200',
            'niveau'       => 'nullable|string',
            'mois_prevu'   => 'nullable|integer|between:1,12',
            'observations' => 'nullable|string',
        ]);

        $formation->update($data);

        return response()->json($formation->load('planFormation:id,titre,annee'));
    }

    public function destroy(int $id): JsonResponse
    {
        Formation::findOrFail($id)->delete();

        return response()->json(null, 204);
    }

    // ── Inscriptions ────────────────────────────────────────────────────────

    public function inscrire(Request $request, int $id): JsonResponse
    {
        $formation = Formation::findOrFail($id);

        $data = $request->validate([
            'employe_id' => 'required|exists:employe,id',
            'statut'     => 'sometimes|string|in:inscrit,present,absent,certifie',
        ]);

        $formation->employes()->syncWithoutDetaching([
            $data['employe_id'] => ['statut' => $data['statut'] ?? 'inscrit'],
        ]);

        return response()->json(['message' => 'Employé inscrit.'], 201);
    }

    public function updateInscription(Request $request, int $id, int $eid): JsonResponse
    {
        $formation = Formation::findOrFail($id);

        $data = $request->validate([
            'statut'  => 'required|string|in:inscrit,present,absent,certifie',
            'suivi'   => 'sometimes|boolean',
            'remarque'=> 'sometimes|nullable|string',
        ]);

        $formation->employes()->updateExistingPivot($eid, $data);

        return response()->json(['message' => 'Statut mis a jour.']);
    }

    public function desinscrire(int $id, int $employeId): JsonResponse
    {
        $formation = Formation::findOrFail($id);
        $formation->employes()->detach($employeId);

        return response()->json(null, 204);
    }

    public function export(): StreamedResponse
    {
        return (new FormationExport())->download();
    }

    public function bulkSync(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'formations'                  => 'required|array',
            'formations.*.intitule'       => 'required|string',
            'formations.*.organisme'      => 'nullable|string',
            'formations.*.duree_jours'    => 'nullable|integer|min:1',
            'formations.*.mois_prevu'     => 'nullable|integer|between:1,12',
            'formations.*.observations'   => 'nullable|string',
        ]);

        $synced = 0;
        foreach ($validated['formations'] as $item) {
            Formation::updateOrCreate(
                ['intitule' => $item['intitule'], 'mois_prevu' => $item['mois_prevu'] ?? null],
                $item
            );
            $synced++;
        }

        return response()->json(['synced' => $synced]);
    }

    public function formationsEmploye(int $employeId): JsonResponse
    {
        $employe = Employe::findOrFail($employeId);

        $formations = $employe->formations()
            ->with('planFormation:id,titre,annee')
            ->orderByDesc('date_debut')
            ->get();

        return response()->json($formations);
    }
}
