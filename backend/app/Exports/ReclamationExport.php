<?php

namespace App\Exports;

use App\Models\Reclamation;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\Shared\Date as XlsDate;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Drawing;
use PhpOffice\PhpSpreadsheet\Worksheet\PageSetup;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Reproduit la feuille « Réclamation_Mars 2026 » du classeur RH : logo, date de
 * mise à jour, titre, en-tête gris et bandes de couleur par trimestre.
 */
class ReclamationExport
{
    private const LIGNE_ENTETE = 12;

    private const COLONNES = [
        'numero' => ['Numéro réclamation', 11.7],
        'date_reception' => ['Date de réception', 17],
        'matricule' => ['Mle', 17],
        'nom_complet' => ['Nom & Prénom', 25.3],
        'type' => ['Type de réclamation', 24.9],
        'description' => ['Description de la réclamation', 23],
        'canal' => ['Canal utilisé par le réclamant', 20],
        'date_reponse_1' => ['Date 1ère réponse', 12.9],
        'contenu_reponse_1' => ['Contenu 1ère réponse apportée', 22.3],
        'date_reponse_2' => ['Date 2ème réponse', 13.1],
        'contenu_reponse_2' => ['Contenu 2ème réponse apportée', 18.1],
        'date_solution' => ['Date de solution définitive', 12.4],
        'etat' => ['État de réclamation', 18.7],
        'remarques' => ['Autres remarques', 11.4],
    ];

    private const TRIMESTRES = [
        1 => ['1er Trimestre', 'FFD966'],
        2 => ['2ème Trimestre', '92D050'],
        3 => ['3ème Trimestre', 'FFFF00'],
        4 => ['4ème Trimestre', '00B050'],
    ];

    // Hauteur minimale d'un trimestre pour que son libellé vertical reste lisible.
    private const HAUTEUR_MIN_TRIMESTRE = 130;

    private const HAUTEUR_MIN_LIGNE = 27;

    public function __construct(private Builder $query) {}

    public function download(string $filename): StreamedResponse
    {
        $parAnnee = $this->query
            ->orderBy('date_reception')
            ->orderBy('id')
            ->get()
            ->groupBy(fn (Reclamation $r) => $r->date_reception->year);

        if ($parAnnee->isEmpty()) {
            $parAnnee = collect([now()->year => collect()]);
        }

        $spreadsheet = new Spreadsheet;
        $spreadsheet->removeSheetByIndex(0);

        foreach ($parAnnee as $annee => $reclamations) {
            $this->remplirFeuille($spreadsheet->createSheet()->setTitle("Réclamation_{$annee}"), $reclamations);
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

    /** @param  Collection<int, Reclamation>  $reclamations */
    private function remplirFeuille(Worksheet $feuille, Collection $reclamations): void
    {
        $this->poserEntete($feuille);

        $ligne = self::LIGNE_ENTETE + 1;
        foreach ($reclamations->groupBy(fn (Reclamation $r) => $r->date_reception->quarter) as $trimestre => $groupe) {
            $premiere = $ligne;
            $hauteurs = [];

            foreach ($groupe as $reclamation) {
                $hauteurs[$ligne] = $this->ecrireLigne($feuille, $ligne, $reclamation);
                $ligne++;
            }

            // Répartit la hauteur manquante pour que la bande reste lisible.
            $manque = max(0, self::HAUTEUR_MIN_TRIMESTRE - array_sum($hauteurs)) / count($hauteurs);
            foreach ($hauteurs as $numero => $hauteur) {
                $feuille->getRowDimension($numero)->setRowHeight($hauteur + $manque);
            }

            $this->poserBandeTrimestre($feuille, $trimestre, $premiere, $ligne - 1);
        }

        if ($ligne > self::LIGNE_ENTETE + 1) {
            $derniere = Coordinate::stringFromColumnIndex(count(self::COLONNES));
            $feuille->getStyle('A'.(self::LIGNE_ENTETE + 1).":{$derniere}".($ligne - 1))->applyFromArray([
                'alignment' => ['vertical' => Alignment::VERTICAL_TOP, 'wrapText' => true],
                'borders' => [
                    'allBorders' => ['borderStyle' => Border::BORDER_THIN],
                    'outline' => ['borderStyle' => Border::BORDER_MEDIUM],
                ],
            ]);
        }
    }

    private function poserEntete(Worksheet $feuille): void
    {
        $feuille->getPageSetup()
            ->setOrientation(PageSetup::ORIENTATION_LANDSCAPE)
            ->setPaperSize(PageSetup::PAPERSIZE_A4)
            ->setFitToWidth(1)
            ->setFitToHeight(0);

        $logo = new Drawing;
        $logo->setPath(resource_path('images/airports_morocco_logo.png'));
        $logo->setCoordinates('A1');
        $logo->setHeight(92);
        $logo->setOffsetX(26);
        $logo->setOffsetY(3);
        $logo->setWorksheet($feuille);

        $feuille->mergeCells('A7:B7');
        $feuille->setCellValueExplicit('A7', 'Date de mise à jour: '.now()->format('d/m/Y'), DataType::TYPE_STRING);

        $feuille->mergeCells('A9:O9');
        $feuille->setCellValue('A9', 'Tableau de suivi et de traitement des réclamations du personnel');
        $feuille->getStyle('A9')->getFont()->setBold(true)->setSize(22);
        $feuille->getStyle('A9')->getAlignment()
            ->setHorizontal(Alignment::HORIZONTAL_CENTER)
            ->setVertical(Alignment::VERTICAL_CENTER);
        $feuille->getRowDimension(9)->setRowHeight(28.5);

        $colonne = 1;
        foreach (self::COLONNES as [$libelle, $largeur]) {
            $lettre = Coordinate::stringFromColumnIndex($colonne++);
            $feuille->setCellValue($lettre.self::LIGNE_ENTETE, $libelle);
            $feuille->getColumnDimension($lettre)->setWidth($largeur);
        }
        $feuille->getColumnDimension(Coordinate::stringFromColumnIndex($colonne))->setWidth(6);

        $derniere = Coordinate::stringFromColumnIndex($colonne - 1);
        $feuille->getRowDimension(self::LIGNE_ENTETE)->setRowHeight(45.75);
        $feuille->getStyle('A'.self::LIGNE_ENTETE.":{$derniere}".self::LIGNE_ENTETE)->applyFromArray([
            'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '808080']],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
                'vertical' => Alignment::VERTICAL_CENTER,
                'wrapText' => true,
            ],
            'borders' => [
                'allBorders' => ['borderStyle' => Border::BORDER_HAIR],
                'outline' => ['borderStyle' => Border::BORDER_MEDIUM],
            ],
        ]);
    }

    /** @return float hauteur estimée de la ligne, en points */
    private function ecrireLigne(Worksheet $feuille, int $ligne, Reclamation $reclamation): float
    {
        $lignesDeTexte = 1;
        $colonne = 1;

        foreach (self::COLONNES as $champ => [, $largeur]) {
            $cellule = Coordinate::stringFromColumnIndex($colonne++).$ligne;
            $valeur = $reclamation->{$champ};

            if ($valeur === null || $valeur === '') {
                continue;
            }

            if (str_starts_with($champ, 'date_')) {
                $feuille->setCellValueExplicit($cellule, XlsDate::PHPToExcel($valeur), DataType::TYPE_NUMERIC);
                $feuille->getStyle($cellule)->getNumberFormat()->setFormatCode('dd/mm/yyyy');
                continue;
            }

            $texte = $champ === 'etat' ? (Reclamation::ETATS[$valeur] ?? $valeur) : (string) $valeur;

            // Écrit en texte explicite : conserve les zéros des matricules et
            // empêche qu'une valeur commençant par « = » devienne une formule.
            $feuille->setCellValueExplicit($cellule, $texte, DataType::TYPE_STRING);
            $lignesDeTexte = max($lignesDeTexte, (int) ceil(mb_strlen($texte) / ($largeur * 1.1)));
        }

        // Excel ne recalcule pas seul la hauteur des lignes dont on fixe la bande fusionnée.
        return min(409, max(self::HAUTEUR_MIN_LIGNE, $lignesDeTexte * 15));
    }

    private function poserBandeTrimestre(Worksheet $feuille, int $trimestre, int $premiere, int $derniere): void
    {
        [$libelle, $couleur] = self::TRIMESTRES[$trimestre];
        $lettre = Coordinate::stringFromColumnIndex(count(self::COLONNES) + 1);
        $plage = "{$lettre}{$premiere}:{$lettre}{$derniere}";

        if ($premiere !== $derniere) {
            $feuille->mergeCells($plage);
        }

        $feuille->setCellValue($lettre.$premiere, $libelle);
        $feuille->getStyle($plage)->applyFromArray([
            'font' => ['bold' => true, 'size' => 16],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $couleur]],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
                'vertical' => Alignment::VERTICAL_CENTER,
                'textRotation' => 90,
            ],
            'borders' => ['outline' => ['borderStyle' => Border::BORDER_MEDIUM]],
        ]);
    }
}
