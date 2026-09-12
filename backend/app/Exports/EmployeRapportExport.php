<?php

namespace App\Exports;

use App\Models\Employe;
use Illuminate\Database\Eloquent\Builder;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

class EmployeRapportExport
{
    private Builder $query;

    public function __construct(?Builder $query = null)
    {
        $this->query = $query ?? Employe::query();
    }

    public function download(string $filename = 'Rapport_Employes.xlsx'): StreamedResponse
    {
        $spreadsheet = new Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Données employés');

        $headers = [
            'Matricule',
            'Nom',
            'Prénom',
            'Sexe',
            'Date de naissance',
            "Date d'embauche",
            'Catégorie',
            'Échelle',
            'Échelon',
            'Entité',
            'Fonction',
            'Qualification',
            'Service',
            'Affectation',
            "Date d'affectation",
            'Statut carrière',
            'Statut',
        ];

        $sheet->fromArray([$headers], null, 'A1');

        $row = 2;
        foreach ($this->buildRows() as $cols) {
            $sheet->fromArray([$cols], null, "A{$row}");
            $row++;
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
     * @return array<int, array<int, mixed>>
     */
    private function buildRows(): array
    {
        $rows = [];

        $employes = $this->query
            ->select([
                'matricule',
                'nom',
                'prenom',
                'sexe',
                'date_naissance',
                'date_embauche',
                'categorie',
                'echelle',
                'echelon',
                'entite',
                'fonction',
                'qualification',
                'service_id',
                'affectation',
                'date_affectation',
                'mutation',
                'date_mutation',
                'retraite',
                'date_retraite',
                'depart_volontaire',
                'date_depart_volontaire',
                'statut',
            ])
            ->with(['service' => fn ($q) => $q->select('id', 'nom')])
            ->orderBy('nom')
            ->orderBy('prenom')
            ->get();

        foreach ($employes as $employe) {
            $rows[] = [
                $employe->matricule,
                $employe->nom,
                $employe->prenom,
                $employe->sexe,
                $employe->date_naissance?->format('d/m/Y'),
                $employe->date_embauche?->format('d/m/Y'),
                $employe->categorie,
                $employe->echelle,
                $employe->echelon,
                $employe->entite,
                $employe->fonction,
                $employe->qualification,
                $employe->service?->nom ?? 'Non renseigné',
                $employe->affectation,
                $employe->date_affectation?->format('d/m/Y'),
                $this->careerStatus($employe),
                $employe->statut,
            ];
        }

        return $rows;
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
