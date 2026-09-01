<?php

namespace App\Exports;

use Illuminate\Support\Collection;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

class EmployeExport
{
    /** @param Collection<int, \App\Models\Employe> $employes */
    public function __construct(private Collection $employes)
    {
    }

    public function download(): StreamedResponse
    {
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Personnel');

        $headers = [
            'Matricule', 'Nom', 'Prénom', 'Sexe',
            'Date naissance', 'Date embauche', 'Catégorie',
            'Échelle', 'Échelon', 'Entité', 'Fonction', 'Qualification',
            'Service', 'Affectation', 'Date affectation',
            'Statut', 'Solde congé (j)', 'Observation',
        ];
        $sheet->fromArray([$headers], null, 'A1');

        $row = 2;
        foreach ($this->employes as $e) {
            $sheet->fromArray([[
                $e->matricule,
                $e->nom,
                $e->prenom,
                $e->sexe ?? '',
                $this->date($e->date_naissance),
                $this->date($e->date_embauche),
                $e->categorie ?? '',
                $e->echelle ?? '',
                $e->echelon ?? '',
                $e->entite ?? '',
                $e->fonction ?? '',
                $e->qualification ?? '',
                $e->service->nom ?? '',
                $e->affectation ?? '',
                $this->date($e->date_affectation),
                $e->statut ?? '',
                $e->solde_conge ?? 0,
                $e->observation ?? '',
            ]], null, "A{$row}");
            $row++;
        }

        $writer = new Xlsx($spreadsheet);

        return response()->stream(function () use ($writer) {
            $writer->save('php://output');
        }, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="personnel.xlsx"',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
        ]);
    }

    private function date($value): string
    {
        if (! $value) {
            return '';
        }

        // Les dates sont castées en Carbon dans le modèle ; sinon on renvoie la valeur brute.
        return method_exists($value, 'format') ? $value->format('d/m/Y') : (string) $value;
    }
}
