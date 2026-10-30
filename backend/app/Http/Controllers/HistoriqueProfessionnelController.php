<?php

namespace App\Http\Controllers;

use App\Models\Employe;
use App\Models\HistoriqueProfessionnel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

class HistoriqueProfessionnelController extends Controller
{
    private const MESSAGES = [
        'date_fin.after_or_equal' => 'La date de fin doit être postérieure ou égale à la date de début.',
    ];

    public function store(Request $request, $employe_id): JsonResponse
    {
        $this->refuserLecteurs($request);

        $employe = Employe::findOrFail($employe_id);
        $data = $request->validate($this->regles(), self::MESSAGES);

        $this->verifierChevauchement($employe->id, $data['date_debut'], $data['date_fin']);

        $periode = new HistoriqueProfessionnel($data);
        $periode->employe_id = $employe->id;
        $periode->save();

        return response()->json($periode->fresh(), 201);
    }

    public function update(Request $request, $id): JsonResponse
    {
        $this->refuserLecteurs($request);

        $periode = HistoriqueProfessionnel::findOrFail($id);

        if ($periode->isCourant()) {
            // Période ouverte : seule la date de début est corrigeable
            $data = $request->validate(['date_debut' => 'required|date']);
            $this->verifierChevauchement((int) $periode->employe_id, $data['date_debut'], null, $periode->id);
            $periode->date_debut = $data['date_debut'];
        } else {
            $data = $request->validate($this->regles(), self::MESSAGES);
            $this->verifierChevauchement((int) $periode->employe_id, $data['date_debut'], $data['date_fin'], $periode->id);
            $periode->fill($data);
        }

        $periode->save();

        return response()->json($periode->fresh());
    }

    public function destroy(Request $request, $id): JsonResponse
    {
        $this->refuserLecteurs($request);

        $periode = HistoriqueProfessionnel::findOrFail($id);

        if ($periode->isCourant()) {
            throw ValidationException::withMessages([
                'periode' => 'La période en cours reflète la situation actuelle et ne peut pas être supprimée.',
            ]);
        }

        $periode->delete();

        return response()->json(['message' => 'Période supprimée.']);
    }

    private function regles(): array
    {
        return [
            'poste' => 'nullable|string|max:255',
            'service' => 'nullable|string|max:255',
            'categorie' => 'nullable|string|max:255',
            'echelle' => 'nullable|string|max:255',
            'date_debut' => 'required|date',
            'date_fin' => 'required|date|after_or_equal:date_debut',
        ];
    }

    // Chevauchement strict (A.debut < B.fin ET B.debut < A.fin) : des périodes contiguës sont acceptées.
    // Fin nulle = aujourd'hui, début nul = pas de borne basse.
    private function verifierChevauchement(int $employeId, string $debut, ?string $fin, ?int $exclureId = null): void
    {
        $aujourdhui = Carbon::today();
        $debutA = Carbon::parse($debut);
        $finA = $fin ? Carbon::parse($fin) : $aujourdhui;

        $autres = HistoriqueProfessionnel::where('employe_id', $employeId)
            ->when($exclureId, fn ($q) => $q->where('id', '!=', $exclureId))
            ->get();

        foreach ($autres as $b) {
            $finB = $b->date_fin ?? $aujourdhui;

            if ($debutA->lt($finB) && (! $b->date_debut || $b->date_debut->lt($finA))) {
                throw ValidationException::withMessages([
                    'date_debut' => sprintf(
                        'Cette période chevauche la période du %s au %s.',
                        $b->date_debut?->format('d/m/Y') ?? '?',
                        $finB->format('d/m/Y'),
                    ),
                ]);
            }
        }
    }

    private function refuserLecteurs(Request $request): void
    {
        abort_if($this->estRole($request, 'dg') || $this->estRole($request, 'employe'), 403, 'Action non autorisée pour ce rôle.');
    }
}
