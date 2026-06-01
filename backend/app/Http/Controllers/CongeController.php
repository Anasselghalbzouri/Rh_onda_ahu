<?php

namespace App\Http\Controllers;

use App\Models\DemandeConge;
use App\Models\Employe;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class CongeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = DemandeConge::with(['employe:id,matricule,nom,prenom,solde_conge'])
            ->orderBy('id', 'desc');

        if ($request->filled('employe_id')) {
            $q->where('employe_id', $request->employe_id);
        }
        if ($request->filled('type_conge')) {
            $q->where('type_conge', $request->type_conge);
        }
        if ($request->filled('statut')) {
            $q->where('statut', $request->statut);
        }

        return response()->json($q->paginate(15));
    }

    public function show(int $id): JsonResponse
    {
        $conge = DemandeConge::with([
            'employe:id,matricule,nom,prenom,solde_conge',
        ])->findOrFail($id);

        return response()->json($conge);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'employe_id'   => 'required|integer|exists:employe,id',
            'type_conge'   => 'required|in:annuel,maladie,maternite,sans_solde,exceptionnel',
            'date_debut'   => 'required|date',
            'date_fin'     => 'required|date|after_or_equal:date_debut',
            'nombre_jours' => 'nullable|integer|min:1',
            'motif'        => 'nullable|string|max:1000',
            'ref_hraccess' => 'nullable|string|max:100',
            'ref_onda_ahu' => 'nullable|string|max:100',
            'fichier'      => 'nullable|file|mimes:pdf,jpg,jpeg,png,doc,docx|max:10240',
        ]);

        if (empty($data['nombre_jours'])) {
            $data['nombre_jours'] = $this->countJours($data['date_debut'], $data['date_fin']);
        }
        // Un congé saisi manuellement par le RH est considéré comme déjà approuvé.
        $data['statut']       = 'approuve';

        // Le solde de l'employé est décrémenté immédiatement à la saisie.
        $employe = Employe::findOrFail($data['employe_id']);
        $nouveau_solde = max(0, $employe->solde_conge - $data['nombre_jours']);
        $employe->update(['solde_conge' => $nouveau_solde]);
        $data['solde_restant'] = $nouveau_solde;

        if ($request->hasFile('fichier')) {
            $file = $request->file('fichier');
            $data['fichier_nom']    = $file->getClientOriginalName();
            $data['fichier_chemin'] = $file->store('conges', 'public');
        }
        unset($data['fichier']);

        $conge = DemandeConge::create($data);
        $conge->load('employe:id,matricule,nom,prenom,solde_conge');

        return response()->json($conge, 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $conge = DemandeConge::with('employe')->findOrFail($id);

        $data = $request->validate([
            'type_conge'   => 'sometimes|in:annuel,maladie,maternite,sans_solde,exceptionnel',
            'date_debut'   => 'sometimes|date',
            'date_fin'     => 'sometimes|date|after_or_equal:date_debut',
            'nombre_jours' => 'nullable|integer|min:1',
            'motif'        => 'nullable|string|max:1000',
            'ref_hraccess' => 'nullable|string|max:100',
            'ref_onda_ahu' => 'nullable|string|max:100',
            'fichier'      => 'nullable|file|mimes:pdf,jpg,jpeg,png,doc,docx|max:10240',
        ]);

        // Si les dates ou le nombre de jours sont modifiés, le solde est recalculé en fonction de la différence.
        $ancienJours = $conge->nombre_jours;
        if (isset($data['date_debut']) || isset($data['date_fin']) || isset($data['nombre_jours'])) {
            if (!empty($data['nombre_jours'])) {
                // La valeur saisie manuellement est prioritaire sur le calcul automatique.
            } else {
                $debut = $data['date_debut'] ?? $conge->date_debut->format('Y-m-d');
                $fin   = $data['date_fin']   ?? $conge->date_fin->format('Y-m-d');
                $data['nombre_jours'] = $this->countJours($debut, $fin);
            }

            $diff    = $data['nombre_jours'] - $ancienJours;
            $employe = $conge->employe;
            $nouveau_solde = max(0, $employe->solde_conge - $diff);
            $employe->update(['solde_conge' => $nouveau_solde]);
            $data['solde_restant'] = $nouveau_solde;
        }

        if ($request->hasFile('fichier')) {
            if ($conge->fichier_chemin) {
                Storage::disk('public')->delete($conge->fichier_chemin);
            }
            $file = $request->file('fichier');
            $data['fichier_nom']    = $file->getClientOriginalName();
            $data['fichier_chemin'] = $file->store('conges', 'public');
        }
        unset($data['fichier']);

        $conge->update($data);

        return response()->json($conge->fresh('employe:id,matricule,nom,prenom,solde_conge'));
    }

    public function destroy(int $id): JsonResponse
    {
        $conge = DemandeConge::with('employe')->findOrFail($id);

        // La suppression d'un congé recrédite automatiquement les jours au solde de l'employé.
        $employe = $conge->employe;
        if ($employe) {
            $employe->update([
                'solde_conge' => $employe->solde_conge + $conge->nombre_jours,
            ]);
        }

        if ($conge->fichier_chemin) {
            Storage::disk('public')->delete($conge->fichier_chemin);
        }

        $conge->delete();

        return response()->json(['message' => 'Congé supprimé, solde recrédité.']);
    }

    public function downloadFichier(int $id): mixed
    {
        $conge = DemandeConge::findOrFail($id);

        if (!$conge->fichier_chemin || !Storage::disk('public')->exists($conge->fichier_chemin)) {
            return response()->json(['message' => 'Aucun fichier attaché.'], 404);
        }

        return Storage::disk('public')->download($conge->fichier_chemin, $conge->fichier_nom);
    }

    private function countJours(string $debut, string $fin): int
    {
        $d = new \DateTime($debut);
        $f = new \DateTime($fin);
        return (int) $d->diff($f)->days + 1;
    }
}
