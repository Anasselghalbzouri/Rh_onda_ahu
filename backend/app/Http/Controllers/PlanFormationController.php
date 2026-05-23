<?php

namespace App\Http\Controllers;

use App\Models\PlanFormation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlanFormationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = PlanFormation::withCount('formations');

        if ($request->filled('annee')) {
            $query->where('annee', $request->annee);
        }

        if ($request->filled('statut')) {
            $query->where('statut', $request->statut);
        }

        return response()->json($query->orderByDesc('annee')->paginate(15));
    }

    public function show(int $id): JsonResponse
    {
        $plan = PlanFormation::withCount('formations')->with('formations')->findOrFail($id);

        return response()->json($plan);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'annee'        => 'required|integer|min:2000|max:2100',
            'titre'        => 'required|string|max:200',
            'description'  => 'nullable|string',
            'budget_total' => 'nullable|numeric|min:0',
            'statut'       => 'sometimes|string|in:draft,valide,clos',
        ]);

        $plan = PlanFormation::create($data);

        return response()->json($plan, 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $plan = PlanFormation::findOrFail($id);

        $data = $request->validate([
            'annee'        => 'sometimes|integer|min:2000|max:2100',
            'titre'        => 'sometimes|string|max:200',
            'description'  => 'nullable|string',
            'budget_total' => 'nullable|numeric|min:0',
            'statut'       => 'sometimes|string|in:draft,valide,clos',
        ]);

        $plan->update($data);

        return response()->json($plan);
    }

    public function destroy(int $id): JsonResponse
    {
        $plan = PlanFormation::findOrFail($id);

        if ($plan->statut !== 'draft') {
            return response()->json(['message' => 'Seul un plan en statut draft peut être supprimé.'], 422);
        }

        $plan->delete();

        return response()->json(null, 204);
    }
}
