<?php

namespace App\Http\Controllers;

use App\Models\EvaluationFormation;
use App\Models\Formation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EvaluationFormationController extends Controller
{
    public function index(int $formationId): JsonResponse
    {
        Formation::findOrFail($formationId);

        $evaluations = EvaluationFormation::with('employe:id,matricule,nom,prenom')
            ->where('formation_id', $formationId)
            ->get();

        return response()->json($evaluations);
    }

    public function store(Request $request, int $formationId): JsonResponse
    {
        Formation::findOrFail($formationId);

        $data = $request->validate([
            'employe_id' => 'required|exists:employe,id',
            'type'       => 'nullable|string|in:chaud,froid',
            'note'       => 'nullable|integer|min:0|max:20',
            'commentaire'=> 'nullable|string',
            'efficace'   => 'nullable|boolean',
            'date_eval'  => 'required|date',
        ]);

        $data['formation_id'] = $formationId;

        $evaluation = EvaluationFormation::create($data);

        return response()->json($evaluation->load('employe:id,matricule,nom,prenom'), 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $evaluation = EvaluationFormation::findOrFail($id);

        $data = $request->validate([
            'type'       => 'sometimes|nullable|string|in:chaud,froid',
            'note'       => 'nullable|integer|min:0|max:20',
            'commentaire'=> 'nullable|string',
            'efficace'   => 'nullable|boolean',
            'date_eval'  => 'sometimes|date',
        ]);

        $evaluation->update($data);

        return response()->json($evaluation->load('employe:id,matricule,nom,prenom'));
    }

    public function destroy(int $id): JsonResponse
    {
        EvaluationFormation::findOrFail($id)->delete();

        return response()->json(null, 204);
    }
}
