<?php

namespace App\Services;

use App\Models\Employe;
use App\Models\RegleCompletude;
use Illuminate\Support\Collection;

class CompletudeService
{
    /** Valeurs texte considérées comme non renseignées (placeholders d'anciens imports). */
    private const PLACEHOLDERS = ['-', '--', 'n/a', 'na', 'nd'];

    /**
     * Un champ est manquant s'il est null, vide, composé uniquement d'espaces,
     * ou égal à un placeholder connu (« - », « -- », « N/A », ...).
     */
    public function estManquant(mixed $valeur): bool
    {
        if ($valeur === null) {
            return true;
        }

        if (is_bool($valeur)) {
            return false;
        }

        if (is_array($valeur)) {
            return count($valeur) === 0;
        }

        $texte = trim((string) $valeur);

        if ($texte === '') {
            return true;
        }

        return in_array(mb_strtolower($texte), self::PLACEHOLDERS, true);
    }

    /**
     * Règles actives applicables à une catégorie d'agent.
     *
     * @return Collection<int, RegleCompletude>
     */
    public function reglesApplicables(?string $categorie): Collection
    {
        return RegleCompletude::query()
            ->where('actif', true)
            ->where(function ($query) use ($categorie) {
                $query->whereNull('categorie');

                if ($categorie !== null && $categorie !== '') {
                    $query->orWhere('categorie', $categorie);
                }
            })
            ->get();
    }

    /**
     * Calcule le taux de complétude pondéré et la liste des libellés manquants obligatoires.
     *
     * @param  array<string, mixed>  $donnees
     * @return array{taux: int, manquants: array<int, string>}
     */
    public function calculer(?string $categorie, array $donnees): array
    {
        $regles = $this->reglesApplicables($categorie);

        $poidsTotal = 0;
        $poidsSatisfaits = 0;
        $manquants = [];

        foreach ($regles as $regle) {
            $poids = max(1, (int) $regle->poids);
            $poidsTotal += $poids;

            if ($this->estManquant($donnees[$regle->champ] ?? null)) {
                if ($regle->obligatoire) {
                    $manquants[] = $regle->libelle;
                }
            } else {
                $poidsSatisfaits += $poids;
            }
        }

        // Aucune règle applicable : rien à satisfaire, donc complétude maximale
        // (évite de reproduire un « faux 0 % »).
        $taux = $poidsTotal > 0
            ? (int) round($poidsSatisfaits / $poidsTotal * 100)
            : 100;

        return ['taux' => $taux, 'manquants' => $manquants];
    }

    /**
     * Libellés des champs obligatoires manquants pour des données d'import/fiche.
     *
     * @param  array<string, mixed>  $donnees
     * @return array<int, string>
     */
    public function champsManquantsPour(?string $categorie, array $donnees): array
    {
        return $this->calculer($categorie, $donnees)['manquants'];
    }

    /**
     * Recalcule et persiste le taux / les champs manquants d'un employé.
     */
    public function recalculer(Employe $employe): void
    {
        $resultat = $this->calculer($employe->categorie, $employe->getAttributes());

        $employe->taux_completude = $resultat['taux'];
        $employe->champs_manquants = $resultat['manquants'];
        $employe->date_dernier_calcul = now();
        $employe->save();
    }
}
