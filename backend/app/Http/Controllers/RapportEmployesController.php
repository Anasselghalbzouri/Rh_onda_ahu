<?php

namespace App\Http\Controllers;

use App\Exports\EmployeRapportExport;
use App\Models\Employe;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class RapportEmployesController extends Controller
{
    public function stats(Request $request): JsonResponse
    {
        $filtres = $request->validate([
            'service_id' => 'nullable|integer|exists:service,id',
            'statut' => 'nullable|string',
        ]);

        $query = $this->applyFilters(Employe::query(), $filtres);

        return response()->json([
            'total' => $query->count(),
            'filtres' => [
                'service_id' => $filtres['service_id'] ?? null,
                'statut' => $filtres['statut'] ?? null,
            ],
        ]);
    }

    public function export(Request $request): StreamedResponse
    {
        $filtres = $request->validate([
            'service_id' => 'nullable|integer|exists:service,id',
            'statut' => 'nullable|string',
        ]);

        $query = $this->applyFilters(Employe::query(), $filtres);
        $filename = 'Rapport_Employes_'.now()->format('Y-m-d').'.xlsx';

        return (new EmployeRapportExport($query))->download($filename);
    }

    /**
     * @param  array<string, mixed>  $filtres
     */
    private function applyFilters(Builder $query, array $filtres): Builder
    {
        if (! empty($filtres['service_id'])) {
            $query->where('service_id', $filtres['service_id']);
        }

        if (! empty($filtres['statut'])) {
            $query->where('statut', $filtres['statut']);
        }

        return $query;
    }
}
