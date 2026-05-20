<?php
require __DIR__ . '/vendor/autoload.php';

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Font;

$spreadsheet = new Spreadsheet();
$sheet = $spreadsheet->getActiveSheet();
$sheet->setTitle('EMPLOYES');

// ── En-têtes ──────────────────────────────────────────────
$headers = [
    'A' => 'MATRICULE',
    'B' => 'NOM',
    'C' => 'PRENOM',
    'D' => 'SEXE',
    'E' => 'DATE_NAISSANCE',
    'F' => 'DATE_EMBAUCHE',
    'G' => 'CATEGORIE',
    'H' => 'ECHELLE',
    'I' => 'ECHELON',
    'J' => 'ENTITE',
    'K' => 'FONCTION',
    'L' => 'QUALIFICATION',
    'M' => 'AFFECTATION',
    'N' => 'DATE_AFFECTATION',
    'O' => 'SOLDE_CONGE',
    'P' => 'STATUT',
    'Q' => 'OBSERVATION',
    'R' => 'STATUT_SYNC',
];

foreach ($headers as $col => $label) {
    $sheet->setCellValue($col . '1', $label);
}

// ── Style en-têtes (A→Q) ──────────────────────────────────
$sheet->getStyle('A1:Q1')->applyFromArray([
    'font'      => ['bold' => true, 'color' => ['rgb' => 'FFFFFF'], 'size' => 10],
    'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '1A3C5E']],
    'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
    'borders'   => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'FFFFFF']]],
]);

// ── Style colonne STATUT_SYNC (R) — grisée ────────────────
$sheet->getStyle('R1')->applyFromArray([
    'font'      => ['bold' => true, 'color' => ['rgb' => '374151'], 'size' => 10],
    'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'D1D5DB']],
    'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
]);

// ── Ligne d'exemple ───────────────────────────────────────
$example = [
    'A' => 'EMP001',
    'B' => 'BENALI',
    'C' => 'Ahmed',
    'D' => 'M',
    'E' => '1985-03-15',
    'F' => '2010-07-01',
    'G' => 'Cadre',
    'H' => '9',
    'I' => '3',
    'J' => 'Direction Technique',
    'K' => 'Ingénieur',
    'L' => "Ingénieur d'État",
    'M' => 'Casablanca',
    'N' => '2015-01-01',
    'O' => '22.5',
    'P' => 'actif',
    'Q' => '',
    'R' => '',
];

foreach ($example as $col => $val) {
    $sheet->setCellValue($col . '2', $val);
}

$sheet->getStyle('A2:R2')->applyFromArray([
    'fill'    => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'F0F9FF']],
    'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'CBD5E1']]],
    'font'    => ['color' => ['rgb' => '64748B'], 'italic' => true],
]);

// ── Note dans la ligne 2 colonne R ────────────────────────
$sheet->setCellValue('R2', '← Rempli par VBA');
$sheet->getStyle('R2')->getFont()->setItalic(true)->setColor(new \PhpOffice\PhpSpreadsheet\Style\Color('FF94A3B8'));

// ── Largeurs colonnes ─────────────────────────────────────
$widths = [
    'A' => 12, 'B' => 16, 'C' => 16, 'D' => 7,
    'E' => 16, 'F' => 16, 'G' => 18, 'H' => 9,
    'I' => 9,  'J' => 22, 'K' => 20, 'L' => 22,
    'M' => 18, 'N' => 16, 'O' => 13, 'P' => 12,
    'Q' => 24, 'R' => 18,
];
foreach ($widths as $col => $width) {
    $sheet->getColumnDimension($col)->setWidth($width);
}

// ── Hauteur ligne 1 ───────────────────────────────────────
$sheet->getRowDimension(1)->setRowHeight(22);

// ── Figer la ligne d'en-têtes ─────────────────────────────
$sheet->freezePane('A2');

// ── Propriétés du fichier ─────────────────────────────────
$spreadsheet->getProperties()
    ->setTitle('Modèle Import Employés — RH ONDA')
    ->setSubject('Fichier de synchronisation employés')
    ->setCreator('Plateforme RH-AHU');

// ── Enregistrement ────────────────────────────────────────
$outputPath = __DIR__ . '/storage/app/public/modele_import_employes.xlsx';
@mkdir(dirname($outputPath), 0755, true);

$writer = new Xlsx($spreadsheet);
$writer->save($outputPath);

echo "Fichier généré : {$outputPath}\n";
