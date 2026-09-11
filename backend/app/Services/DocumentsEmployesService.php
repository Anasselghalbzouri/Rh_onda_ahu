<?php

namespace App\Services;

use App\Models\Employe;
use App\Models\PieceJointe;
use Illuminate\Support\Collection;

/**
 * Vue globale RH des documents employés : documents actifs de tous les employés
 * + entrées synthétiques « manquant » (catégories obligatoires absentes).
 */
class DocumentsEmployesService
{
    /**
     * @return array<int, array<string, mixed>>
     */
    public function listeGlobale(?string $q = null, ?string $categorie = null, ?string $statut = null): array
    {
        $lignes = $this->documentsExistants($q, $categorie)
            ->merge($this->documentsManquants($q, $categorie));

        if ($statut) {
            $lignes = $lignes->where('statut', $statut);
        }

        return $lignes->values()->all();
    }

    private function documentsExistants(?string $q, ?string $categorie): Collection
    {
        return PieceJointe::query()
            ->where('entite', 'employe')
            ->where('actif', true)
            ->when($categorie, fn ($query) => $query->where('categorie', $categorie))
            ->with(['employe' => fn ($query) => $query->select('id', 'matricule', 'nom', 'prenom')])
            ->when($q, function ($query) use ($q) {
                $query->whereHas('employe', function ($sub) use ($q) {
                    $sub->where('nom', 'like', "%{$q}%")
                        ->orWhere('prenom', 'like', "%{$q}%")
                        ->orWhere('matricule', 'like', "%{$q}%");
                });
            })
            ->orderByDesc('date_upload')
            ->get()
            ->map(fn (PieceJointe $p) => [
                'id'              => $p->id,
                'employe'         => $p->employe ? [
                    'id'        => $p->employe->id,
                    'matricule' => $p->employe->matricule,
                    'nom'       => $p->employe->nom,
                    'prenom'    => $p->employe->prenom,
                ] : null,
                'nom_original'    => $p->nom_original,
                'categorie'       => $p->categorie,
                'statut'          => $p->statutCalcule(),
                'date_expiration' => $p->date_expiration?->format('Y-m-d'),
                'obligatoire'     => $p->obligatoire,
                'date_upload'     => $p->date_upload?->format('d/m/Y H:i'),
                'taille'          => $p->taille_humaine,
            ]);
    }

    /**
     * Catégories marquées obligatoires pour au moins un employé mais absentes
     * des documents actifs d'un employé donné (data-model.md § Entité dérivée).
     */
    private function documentsManquants(?string $q, ?string $categorie): Collection
    {
        $categoriesObligatoires = PieceJointe::query()
            ->where('entite', 'employe')
            ->where('actif', true)
            ->where('obligatoire', true)
            ->whereNotNull('categorie')
            ->distinct()
            ->pluck('categorie')
            ->when($categorie, fn ($cats) => $cats->filter(fn ($c) => $c === $categorie)->values());

        if ($categoriesObligatoires->isEmpty()) {
            return collect();
        }

        return Employe::query()
            ->when($q, function ($query) use ($q) {
                $query->where('nom', 'like', "%{$q}%")
                    ->orWhere('prenom', 'like', "%{$q}%")
                    ->orWhere('matricule', 'like', "%{$q}%");
            })
            ->orderBy('nom')
            ->get(['id', 'matricule', 'nom', 'prenom'])
            ->flatMap(function (Employe $employe) use ($categoriesObligatoires) {
                $presentes = PieceJointe::query()
                    ->where('entite', 'employe')
                    ->where('entite_id', $employe->id)
                    ->where('actif', true)
                    ->whereNotNull('categorie')
                    ->distinct()
                    ->pluck('categorie');

                return $categoriesObligatoires
                    ->diff($presentes)
                    ->map(fn (string $cat) => [
                        'id'              => null,
                        'employe'         => [
                            'id'        => $employe->id,
                            'matricule' => $employe->matricule,
                            'nom'       => $employe->nom,
                            'prenom'    => $employe->prenom,
                        ],
                        'nom_original'    => null,
                        'categorie'       => $cat,
                        'statut'          => 'manquant',
                        'date_expiration' => null,
                        'obligatoire'     => true,
                        'date_upload'     => null,
                        'taille'          => null,
                    ]);
            });
    }
}
