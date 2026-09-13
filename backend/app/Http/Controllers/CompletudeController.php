<?php

namespace App\Http\Controllers;

use App\Models\Employe;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class CompletudeController extends Controller
{
    public function dossiersIncomplets(Request $request): JsonResponse
    {
        $filtres = $request->validate([
            'service_id' => 'nullable|integer',
            'categorie' => 'nullable|string|max:100',
        ]);

        $query = Employe::with('service')
            ->where('statut', 'actif')
            ->whereNotNull('champs_manquants');

        if (! empty($filtres['service_id'])) {
            $query->where('service_id', $filtres['service_id']);
        }

        if (! empty($filtres['categorie'])) {
            $query->where('categorie', $filtres['categorie']);
        }

        $employes = $query->orderBy('nom')->get()
            ->filter(fn (Employe $employe) => ! empty($employe->champs_manquants));

        $groupes = [];

        foreach ($employes as $employe) {
            $key = $employe->service_id ?? 'null';

            if (! isset($groupes[$key])) {
                $groupes[$key] = [
                    'service_id' => $employe->service_id,
                    'service_nom' => $employe->service?->nom ?? 'Service non défini',
                    'employes' => [],
                ];
            }

            $groupes[$key]['employes'][] = [
                'id' => $employe->id,
                'matricule' => $employe->matricule,
                'nom_complet' => $employe->nom_complet,
                'categorie' => $employe->categorie,
                'taux_completude' => $employe->taux_completude,
                'champs_manquants' => $employe->champs_manquants,
                'date_dernier_calcul' => $employe->date_dernier_calcul,
            ];
        }

        // Groupe « Service non défini » toujours présent, même vide.
        if (! isset($groupes['null'])) {
            $groupes['null'] = [
                'service_id' => null,
                'service_nom' => 'Service non défini',
                'employes' => [],
            ];
        }

        $services = array_values($groupes);
        usort($services, fn ($a, $b) => strcmp((string) $a['service_nom'], (string) $b['service_nom']));

        return response()->json(['services' => $services]);
    }

    public function taux(Request $request): JsonResponse
    {
        $employes = Employe::with('service')
            ->where('statut', 'actif')
            ->get();

        return response()->json([
            'par_service' => $this->agregerParService($employes),
            'par_categorie' => $this->agregerParCategorie($employes),
        ]);
    }

    /**
     * @param  Collection<int, Employe>  $employes
     * @return array<int, array<string, mixed>>
     */
    private function agregerParService($employes): array
    {
        $groupes = [];

        foreach ($employes as $employe) {
            $key = $employe->service_id ?? 'null';

            if (! isset($groupes[$key])) {
                $groupes[$key] = [
                    'service_id' => $employe->service_id,
                    'service_nom' => $employe->service?->nom ?? 'Service non défini',
                    'taux' => [],
                    'nb_agents_actifs' => 0,
                    'nb_complets' => 0,
                ];
            }

            $groupes[$key]['nb_agents_actifs']++;

            if ($employe->taux_completude !== null) {
                $groupes[$key]['taux'][] = $employe->taux_completude;
            }

            if ($employe->taux_completude === 100) {
                $groupes[$key]['nb_complets']++;
            }
        }

        // Groupe « service non défini » toujours présent (état vide explicite).
        if (! isset($groupes['null'])) {
            $groupes['null'] = [
                'service_id' => null,
                'service_nom' => 'Aucun agent actif',
                'taux' => [],
                'nb_agents_actifs' => 0,
                'nb_complets' => 0,
            ];
        } elseif ($groupes['null']['nb_agents_actifs'] === 0) {
            $groupes['null']['service_nom'] = 'Aucun agent actif';
        }

        $resultat = array_map(function (array $groupe) {
            $taux = $groupe['taux'];

            return [
                'service_id' => $groupe['service_id'],
                'service_nom' => $groupe['service_nom'],
                'nb_agents_actifs' => $groupe['nb_agents_actifs'],
                'taux_moyen' => count($taux) > 0 ? (int) round(array_sum($taux) / count($taux)) : null,
                'nb_complets' => $groupe['nb_complets'],
            ];
        }, $groupes);

        usort($resultat, fn ($a, $b) => strcmp((string) $a['service_nom'], (string) $b['service_nom']));

        return array_values($resultat);
    }

    /**
     * @param  Collection<int, Employe>  $employes
     * @return array<int, array<string, mixed>>
     */
    private function agregerParCategorie($employes): array
    {
        $groupes = [];

        foreach ($employes as $employe) {
            $key = $employe->categorie ?? 'null';

            if (! isset($groupes[$key])) {
                $groupes[$key] = [
                    'categorie' => $employe->categorie,
                    'taux' => [],
                    'nb_agents_actifs' => 0,
                    'nb_complets' => 0,
                ];
            }

            $groupes[$key]['nb_agents_actifs']++;

            if ($employe->taux_completude !== null) {
                $groupes[$key]['taux'][] = $employe->taux_completude;
            }

            if ($employe->taux_completude === 100) {
                $groupes[$key]['nb_complets']++;
            }
        }

        $resultat = array_map(function (array $groupe) {
            $taux = $groupe['taux'];

            return [
                'categorie' => $groupe['categorie'],
                'nb_agents_actifs' => $groupe['nb_agents_actifs'],
                'taux_moyen' => count($taux) > 0 ? (int) round(array_sum($taux) / count($taux)) : null,
                'nb_complets' => $groupe['nb_complets'],
            ];
        }, $groupes);

        usort($resultat, fn ($a, $b) => strcmp((string) $a['categorie'], (string) $b['categorie']));

        return array_values($resultat);
    }
}
