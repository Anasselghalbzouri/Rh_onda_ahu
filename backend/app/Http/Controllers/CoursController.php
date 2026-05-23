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
}
