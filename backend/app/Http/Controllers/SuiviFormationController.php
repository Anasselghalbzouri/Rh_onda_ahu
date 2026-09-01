<?php

namespace App\Http\Controllers;

use App\Models\Cours;
use App\Models\Employe;
use App\Models\Formation;
use App\Models\PlanFormation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class SuiviFormationController extends Controller
{
    /**
     * Synchronise les lignes de la feuille "Suivi de Formation" (classeur
     * "Tableau de Suivi de Formation siège.xlsx") vers la plateforme.
     *
     * Chaque ligne relie un collaborateur (identifié par nom en texte libre,
     * pas de matricule dans ce fichier) à un cours et une période. On :
     *  - retrouve/crée le Cours par thème,
     *  - retrouve/crée la Formation par (cours, date_debut, date_fin),
     *  - retrouve l'Employé par correspondance de nom (best effort),
     *  - inscrit l'employé sur la formation avec statut/suivi/remarque.
     */
    public function bulkSync(Request $request): JsonResponse
    {
        $data = $request->validate([
            'lignes'                  => 'required|array|min:1',
            'lignes.*.collaborateur'  => 'required|string|max:255',
            'lignes.*.cours'          => 'required|string|max:255',
            'lignes.*.service'        => 'nullable|string|max:255',
            'lignes.*.date_debut'     => 'nullable|date',
            'lignes.*.date_fin'       => 'nullable|date',
            'lignes.*.suivi'          => 'nullable|boolean',
            'lignes.*.remarque'       => 'nullable|string',
        ]);

        $employes = Employe::select('id', 'nom', 'prenom')->get();
        $employesIndex = [];
        foreach ($employes as $e) {
            $employesIndex[$this->normalize("{$e->nom} {$e->prenom}")] = $e->id;
            $employesIndex[$this->normalize("{$e->prenom} {$e->nom}")] = $e->id;
        }

        $results = [];
        $employesMatched = 0;
        $employesIntrouvables = 0;
        $formationsCreated = 0;

        foreach ($data['lignes'] as $row) {
            $cours = Cours::firstOrCreate(['theme' => trim($row['cours'])]);

            $datesEstimees = empty($row['date_debut']);
            $dateDebut = $row['date_debut'] ?? now()->toDateString();
            $dateFin   = $row['date_fin'] ?? $dateDebut;

            $annee = (int) date('Y', strtotime($dateDebut));
            $plan = PlanFormation::firstOrCreate(
                ['annee' => $annee, 'titre' => 'Suivi de formation (import)'],
                ['statut' => 'valide']
            );

            $formation = Formation::firstOrCreate(
                [
                    'cours_id'   => $cours->id,
                    'date_debut' => $dateDebut,
                    'date_fin'   => $dateFin,
                ],
                [
                    'plan_formation_id' => $plan->id,
                    'intitule' => $cours->theme,
                    'type'     => 'interne',
                    'observations' => $row['service'] ?? null,
                ]
            );
            if ($formation->wasRecentlyCreated) {
                $formationsCreated++;
            }

            $employeId = $employesIndex[$this->normalize($row['collaborateur'])] ?? null;

            $rowResult = [
                'collaborateur' => $row['collaborateur'],
                'cours'         => $cours->theme,
                'formation_id'  => $formation->id,
                'dates_estimees' => $datesEstimees,
            ];

            if ($employeId) {
                $formation->employes()->syncWithoutDetaching([
                    $employeId => [
                        'statut'   => ($row['suivi'] ?? false) ? 'present' : 'inscrit',
                        'suivi'    => (bool) ($row['suivi'] ?? false),
                        'remarque' => $row['remarque'] ?? null,
                    ],
                ]);
                $employesMatched++;
                $rowResult['employe_status'] = 'matched';
            } else {
                $employesIntrouvables++;
                $rowResult['employe_status'] = 'introuvable';
            }

            $results[] = $rowResult;
        }

        return response()->json([
            'total'                  => count($data['lignes']),
            'formations_created'    => $formationsCreated,
            'employes_matched'      => $employesMatched,
            'employes_introuvables' => $employesIntrouvables,
            'results'               => $results,
        ]);
    }

    private function normalize(string $value): string
    {
        return Str::of($value)->ascii()->upper()->squish()->toString();
    }
}
