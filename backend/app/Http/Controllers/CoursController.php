<?php

namespace App\Http\Controllers;

use App\Models\Cours;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CoursController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Cours::orderBy('theme')->get());
    }

    public function show(int $id): JsonResponse
    {
        return response()->json(Cours::findOrFail($id));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'theme'       => 'required|string|max:255',
            'description' => 'nullable|string',
            'duree_jours' => 'nullable|integer|min:1|max:365',
        ]);

        return response()->json(Cours::create($data), 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $cours = Cours::findOrFail($id);

        $data = $request->validate([
            'theme'       => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'duree_jours' => 'nullable|integer|min:1|max:365',
        ]);

        $cours->update($data);

        return response()->json($cours);
    }

    public function destroy(int $id): JsonResponse
    {
        Cours::findOrFail($id)->delete();

        return response()->json(null, 204);
    }

    public function bulkSync(Request $request): JsonResponse
    {
        $data = $request->validate([
            'cours'                    => 'required|array|min:1',
            'cours.*.theme'            => 'required|string|max:255',
            'cours.*.description'      => 'nullable|string',
            'cours.*.duree_jours'      => 'nullable|integer|min:1|max:365',
        ]);

        $created = 0;
        $updated = 0;
        $results = [];

        foreach ($data['cours'] as $row) {
            $fields = array_intersect_key($row, array_flip(['description', 'duree_jours']));

            $cours = Cours::updateOrCreate(
                ['theme' => $row['theme']],
                $fields
            );

            $cours->wasRecentlyCreated ? $created++ : $updated++;
            $results[] = ['theme' => $row['theme'], 'status' => $cours->wasRecentlyCreated ? 'created' : 'updated'];
        }

        return response()->json([
            'total'   => count($data['cours']),
            'created' => $created,
            'updated' => $updated,
            'results' => $results,
        ]);
    }
}
