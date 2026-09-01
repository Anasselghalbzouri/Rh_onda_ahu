<?php

namespace App\Http\Controllers;

use App\Models\Employe;
use App\Models\Formation;
use App\Services\XlsxSurgicalPatcher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class RapportActiviteController extends Controller
{
    /**
     * Indicateurs calculables du rapport PS09 "Rapport d'activité Trimestriel"
     * pour un trimestre/année donné. Ne couvre QUE les indicateurs qui ont une
     * source de données dans la plateforme (formations, effectif) — les
     * indicateurs sans table dédiée (accidents du travail, polyvalence,
     * réclamations, actions d'amélioration, stagiaires...) restent saisis
     * manuellement dans le fichier Excel.
     */
    public function stats(Request $request): JsonResponse
    {
        $data = $request->validate([
            'annee'     => 'required|integer|min:2000|max:2100',
            'trimestre' => 'required|integer|min:1|max:4',
        ]);

        return response()->json($this->computeStats((int) $data['annee'], (int) $data['trimestre']));
    }

    /**
     * Liste les feuilles (une par trimestre) disponibles dans le classeur
     * maître, pour alimenter un sélecteur côté frontend.
     */
    public function sheets(): JsonResponse
    {
        $templatePath = config('rapport.ps09_template_path');
        if (! is_file($templatePath)) {
            return response()->json(['message' => "Modèle PS09 introuvable sur le serveur."], 404);
        }

        $zip = new \ZipArchive();
        $zip->open($templatePath);
        $workbookXml = $zip->getFromName('xl/workbook.xml');
        $zip->close();

        $dom = new \DOMDocument();
        $dom->loadXML($workbookXml);
        $names = [];
        foreach ($dom->getElementsByTagName('sheet') as $sheet) {
            $names[] = $sheet->getAttribute('name');
        }

        return response()->json(['sheets' => $names]);
    }

    /**
     * Génère une copie du classeur PS09 avec les cellules calculables
     * remplies pour le trimestre/année demandé, en modifiant uniquement le
     * XML de la feuille ciblée (les 11 graphiques natifs par feuille restent
     * strictement inchangés — voir App\Services\XlsxSurgicalPatcher).
     */
    public function export(Request $request): BinaryFileResponse
    {
        $data = $request->validate([
            'sheet'     => 'required|string',
            'annee'     => 'required|integer|min:2000|max:2100',
            'trimestre' => 'required|integer|min:1|max:4',
        ]);

        $templatePath = config('rapport.ps09_template_path');
        abort_unless(is_file($templatePath), 404, 'Modèle PS09 introuvable sur le serveur.');

        $stats = $this->computeStats((int) $data['annee'], (int) $data['trimestre']);

        $tempPath = storage_path('app/rapport-export-' . uniqid() . '.xlsx');

        $patcher = XlsxSurgicalPatcher::openCopy($templatePath, $tempPath);
        try {
            $sheetPath = $patcher->sheetXmlPathFor($data['sheet']);
            $dom = $patcher->loadSheetDom($sheetPath);

            $formationHeaderRow = $patcher->findHeaderRow($dom, 'Nbre de Formation Planifi');
            if ($formationHeaderRow !== null) {
                $lastRow = $patcher->lastRowWithValue($dom, 'C', $formationHeaderRow);
                $targetRow = $lastRow > $formationHeaderRow ? $lastRow : $formationHeaderRow + 1;

                $colF = $patcher->findColInRow($dom, $formationHeaderRow, 'Nbre de Formation Planifi');
                $colG = $patcher->findColInRow($dom, $formationHeaderRow, 'Nbre de Formations R');
                $colJ = $patcher->findColInRow($dom, $formationHeaderRow, 'Nbre des Formations Eval');
                $colM = $patcher->findColInRow($dom, $formationHeaderRow, 'formations efficaces');

                if ($colF) $patcher->setNumericCell($dom, $colF . $targetRow, $stats['formation']['planifiees']);
                if ($colG) $patcher->setNumericCell($dom, $colG . $targetRow, $stats['formation']['realisees']);
                if ($colJ) $patcher->setNumericCell($dom, $colJ . $targetRow, $stats['formation']['evaluees']);
                if ($colM) $patcher->setNumericCell($dom, $colM . $targetRow, $stats['formation']['efficaces']);
            }

            $effectifHeaderRow = $patcher->findHeaderRow($dom, "effectif int");
            if ($effectifHeaderRow !== null) {
                $yearCol = $patcher->findColInRow($dom, $effectifHeaderRow, 'Ann');
                $colIntegres = $patcher->findColInRow($dom, $effectifHeaderRow, 'effectif int');
                $colDeparts = $patcher->findColInRow($dom, $effectifHeaderRow, 'de d');
                $colMutations = $patcher->findColInRow($dom, $effectifHeaderRow, 'mutation');

                $targetYearRow = $yearCol
                    ? $patcher->findRowByYear($dom, $effectifHeaderRow, $yearCol, (int) $data['annee'])
                    : null;

                if ($targetYearRow !== null) {
                    if ($colIntegres) $patcher->setNumericCell($dom, $colIntegres . $targetYearRow, $stats['effectif']['integres']);
                    if ($colDeparts) $patcher->setNumericCell($dom, $colDeparts . $targetYearRow, $stats['effectif']['departs']);
                    if ($colMutations) $patcher->setNumericCell($dom, $colMutations . $targetYearRow, $stats['effectif']['mutations']);
                }
            }

            $patcher->saveSheetDom($sheetPath, $dom);
            $patcher->forceFullRecalcOnLoad();
        } finally {
            $patcher->close();
        }

        $downloadName = 'PS09_Rapport_activite_' . $data['annee'] . '_T' . $data['trimestre'] . '.xlsx';

        return response()->download($tempPath, $downloadName, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend(true);
    }

    private function computeStats(int $annee, int $trimestre): array
    {
        $startMonth = ($trimestre - 1) * 3 + 1;
        $debut = "{$annee}-" . str_pad((string) $startMonth, 2, '0', STR_PAD_LEFT) . '-01';
        $fin = date('Y-m-t', strtotime("{$annee}-" . str_pad((string) ($startMonth + 2), 2, '0', STR_PAD_LEFT) . '-01'));

        $formationsQuarter = Formation::whereBetween('date_debut', [$debut, $fin]);
        $planifiees = (clone $formationsQuarter)->count();
        $realisees = (clone $formationsQuarter)->whereDate('date_fin', '<', now())->count();
        $evaluees = (clone $formationsQuarter)->whereHas('evaluations')->count();
        $efficaces = (clone $formationsQuarter)
            ->whereHas('evaluations', fn ($q) => $q->where('efficace', true))
            ->count();

        $integres = Employe::whereYear('date_embauche', $annee)->count();
        $departs = Employe::where(function ($q) use ($annee) {
            $q->where(function ($q2) use ($annee) {
                $q2->where('retraite', true)->whereYear('date_retraite', $annee);
            })->orWhere(function ($q2) use ($annee) {
                $q2->where('depart_volontaire', true)->whereYear('date_depart_volontaire', $annee);
            });
        })->count();
        $mutations = Employe::where('mutation', true)->whereYear('date_mutation', $annee)->count();

        return [
            'annee' => $annee,
            'trimestre' => $trimestre,
            'periode' => ['debut' => $debut, 'fin' => $fin],
            'formation' => [
                'planifiees' => $planifiees,
                'realisees' => $realisees,
                'evaluees' => $evaluees,
                'efficaces' => $efficaces,
            ],
            'effectif' => [
                'integres' => $integres,
                'departs' => $departs,
                'mutations' => $mutations,
            ],
        ];
    }
}
