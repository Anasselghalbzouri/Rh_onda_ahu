<?php

namespace App\Http\Controllers;

use App\Models\DemandeConge;
use App\Models\Employe;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class CongeController extends Controller
{
    // GET /api/conges?employe_id=&type_conge=&statut=&page=
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

    // GET /api/conges/{id}
    public function show(int $id): JsonResponse
    {
        $conge = DemandeConge::with([
            'employe:id,matricule,nom,prenom,solde_conge',
        ])->findOrFail($id);

        return response()->json($conge);
    }

    // POST /api/conges  — saisie directe d'un congé (multipart/form-data)
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

        // Utiliser la valeur manuelle si fournie, sinon calculer
        if (empty($data['nombre_jours'])) {
            $data['nombre_jours'] = $this->countJours($data['date_debut'], $data['date_fin']);
        }
        $data['statut']       = 'approuve'; // saisie directe = déjà validé

        // Déduire du solde congé de l'employé
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

    // PUT /api/conges/{id}
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

        // Recalcul du solde si dates ou nombre_jours changent
        $ancienJours = $conge->nombre_jours;
        if (isset($data['date_debut']) || isset($data['date_fin']) || isset($data['nombre_jours'])) {
            if (!empty($data['nombre_jours'])) {
                // Valeur manuelle prioritaire
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

    // DELETE /api/conges/{id} — recrédite le solde
    public function destroy(int $id): JsonResponse
    {
        $conge = DemandeConge::with('employe')->findOrFail($id);

        // Recréditer les jours au solde de l'employé
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

    // GET /api/conges/{id}/fichier
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
