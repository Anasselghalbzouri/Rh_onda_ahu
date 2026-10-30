<?php

namespace App\Exports;

use App\Models\Employe;
use Illuminate\Database\Eloquent\Builder;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

class EmployeRapportExport
{
    /** Colonnes proposées à l'export, dans l'ordre du fichier. */
    public const COLONNES = [
        'matricule' => 'Matricule',
        'nom' => 'Nom',
        'prenom' => 'Prénom',
        'sexe' => 'Sexe',
        'date_naissance' => 'Date de naissance',
        'date_embauche' => "Date d'embauche",
        'categorie' => 'Catégorie',
        'echelle' => 'Échelle',
        'echelon' => 'Échelon',
        'entite' => 'Entité',
        'fonction' => 'Fonction',
        'qualification' => 'Qualification',
        'service' => 'Service',
        'affectation' => 'Affectation',
        'date_affectation' => "Date d'affectation",
        'statut_carriere' => 'Statut carrière',
        'statut' => 'Statut',
        'solde_conge' => 'Solde congé (j)',
        'observation' => 'Observation',
    ];

    /** @param  array<int, string>  $colonnes */
    public function __construct(private array $colonnes, private Builder $query) {}

    public function download(string $filename = 'Rapport_Employes.xlsx'): StreamedResponse
    {
        $spreadsheet = new Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Données employés');

        // L'ordre suit toujours COLONNES, quel que soit celui de la requête.
        $colonnes = array_intersect_key(self::COLONNES, array_flip($this->colonnes));
        $sheet->fromArray([array_values($colonnes)], null, 'A1');

        foreach ($this->lignes() as $index => $ligne) {
            foreach (array_keys($colonnes) as $position => $cle) {
                $valeur = $ligne[$cle];

                if ($valeur === null || $valeur === '') {
                    continue;
                }

                // Écrit en texte explicite : conserve les zéros des matricules et
                // empêche qu'une valeur commençant par « = » devienne une formule.
                $sheet->setCellValueExplicit(
                    Coordinate::stringFromColumnIndex($position + 1).($index + 2),
                    $valeur,
                    $cle === 'solde_conge' ? DataType::TYPE_NUMERIC : DataType::TYPE_STRING,
                );
            }
        }

        $writer = new Xlsx($spreadsheet);

        return response()->stream(function () use ($writer) {
            $writer->save('php://output');
        }, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
        ]);
    }

    /**
     * Valeurs des colonnes choisies, partagées par l'aperçu et le fichier.
     *
     * @return array<int, array<string, mixed>>
     */
    public function lignes(): array
    {
        $cles = array_keys(array_intersect_key(self::COLONNES, array_flip($this->colonnes)));

        if ($cles === []) {
            return [];
        }

        return $this->query
            ->with(['service' => fn ($q) => $q->select('id', 'nom')])
            ->orderBy('nom')
            ->orderBy('prenom')
            ->get()
            ->map(fn (Employe $employe) => array_combine(
                $cles,
                array_map(fn (string $cle) => $this->valeur($employe, $cle), $cles),
            ))
            ->all();
    }

    private function valeur(Employe $employe, string $cle): mixed
    {
        return match ($cle) {
            'service' => $employe->service?->nom ?? 'Non renseigné',
            'statut_carriere' => $this->careerStatus($employe),
            'date_naissance', 'date_embauche', 'date_affectation' => $employe->{$cle}?->format('d/m/Y'),
            default => $employe->{$cle},
        };
    }

    private function careerStatus(Employe $employe): string
    {
        if ($employe->depart_volontaire && $employe->date_depart_volontaire) {
            return 'Départ volontaire le '.$employe->date_depart_volontaire->format('d/m/Y');
        }

        if ($employe->retraite && $employe->date_retraite) {
            return 'Retraite le '.$employe->date_retraite->format('d/m/Y');
        }

        if ($employe->mutation && $employe->date_mutation) {
            return 'Mutation le '.$employe->date_mutation->format('d/m/Y');
        }

        return 'En activité';
    }
}
