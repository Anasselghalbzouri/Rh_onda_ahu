<?php

namespace App\Exports;

use App\Models\Formation;
use App\Models\Cours;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;

class FormationExport
{
    private static array $MOIS = [
        1 => 'Jan', 2 => 'Fév', 3 => 'Mar', 4 => 'Avr',
        5 => 'Mai', 6 => 'Jun', 7 => 'Jul', 8 => 'Aoû',
        9 => 'Sep', 10 => 'Oct', 11 => 'Nov', 12 => 'Déc',
    ];

    public function download(): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $spreadsheet = new Spreadsheet();
        $spreadsheet->removeSheetByIndex(0);

        $this->buildProgrammeAnnuel($spreadsheet);
        $this->buildSuiviFormation($spreadsheet);
        $this->buildCatalogueCours($spreadsheet);

        $writer = new Xlsx($spreadsheet);

        return response()->stream(function () use ($writer) {
            $writer->save('php://output');
        }, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="formations.xlsx"',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
        ]);
    }

    private function buildProgrammeAnnuel(Spreadsheet $spreadsheet): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('Programme annuel');

        $headers = ['N°', 'Thème', 'Participants', 'Organisme', 'Durée(j)'];
        foreach (self::$MOIS as $label) {
            $headers[] = $label;
        }
        $headers[] = 'Observations';

        $sheet->fromArray([$headers], null, 'A1');

        $formations = Formation::with('employes')->orderBy('mois_prevu')->get();

        $row = 2;
        foreach ($formations as $i => $f) {
            $cols = [
                $i + 1,
                $f->intitule,
                $f->employes->count(),
                $f->organisme ?? '',
                $f->duree_jours ?? '',
            ];

            for ($m = 1; $m <= 12; $m++) {
                if ((int) $f->mois_prevu === $m) {
                    $cols[] = in_array($f->statut, ['realise', 'terminee']) ? '●' : 'x';
                } else {
                    $cols[] = '';
                }
            }

            $cols[] = $f->observations ?? '';
            $sheet->fromArray([$cols], null, "A{$row}");
            $row++;
        }
    }

    private function buildSuiviFormation(Spreadsheet $spreadsheet): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('Suivi de Formation');

        $sheet->fromArray([[
            'Date', 'Collaborateur', 'Cours', 'Service', 'Suivi', 'Remarque',
        ]], null, 'A1');

        $rows = DB::table('employe_formation as fe')
            ->join('employe as e', 'e.id', '=', 'fe.employe_id')
            ->join('formation as f', 'f.id', '=', 'fe.formation_id')
            ->leftJoin('cours as c', 'c.id', '=', 'f.cours_id')
            ->leftJoin('services as s', 's.id', '=', 'e.service_id')
            ->select(
                'f.date_debut',
                DB::raw("CONCAT(e.prenom, ' ', e.nom) as collaborateur"),
                DB::raw('COALESCE(c.theme, f.intitule) as cours'),
                DB::raw('COALESCE(s.nom, "") as service'),
                'fe.suivi',
                'fe.remarque'
            )
            ->orderBy('f.date_debut')
            ->get();

        $row = 2;
        foreach ($rows as $r) {
            $sheet->fromArray([[
                $r->date_debut,
                $r->collaborateur,
                $r->cours,
                $r->service,
                $r->suivi ? 'OUI' : 'NON',
                $r->remarque ?? '',
            ]], null, "A{$row}");
            $row++;
        }
    }

    private function buildCatalogueCours(Spreadsheet $spreadsheet): void
    {
        $sheet = $spreadsheet->createSheet();
        $sheet->setTitle('Catalogue cours');

        $sheet->fromArray([['ID', 'Thème', 'Description', 'Durée(j)']], null, 'A1');

        $row = 2;
        foreach (Cours::orderBy('theme')->get() as $cours) {
            $sheet->fromArray([[
                $cours->id,
                $cours->theme,
                $cours->description ?? '',
                $cours->duree_jours ?? '',
            ]], null, "A{$row}");
            $row++;
        }
    }
}
