<?php

namespace App\Services;

use RuntimeException;
use ZipArchive;

/**
 * Modifie des valeurs de cellules numériques dans une feuille d'un .xlsx
 * en éditant directement le XML interne de l'archive OOXML, sans jamais
 * réécrire le fichier via une bibliothèque de haut niveau (PhpSpreadsheet,
 * openpyxl...). Ces bibliothèques ne savent pas re-sérialiser des graphiques
 * Excel natifs complexes et les suppriment silencieusement au moindre
 * save() — cette classe garantit que toutes les parties du fichier
 * (graphiques, mises en forme, styles...) restent strictement identiques
 * en dehors des cellules explicitement modifiées.
 *
 * Usage :
 *   $patcher = XlsxSurgicalPatcher::openCopy($template, $destination);
 *   $sheetPath = $patcher->sheetXmlPathFor('E3 Rap Act Oct 2025');
 *   $dom = $patcher->loadSheetDom($sheetPath);
 *   $headerRow = $patcher->findHeaderRow($dom, 'Trimestre');
 *   $col = $patcher->findColInRow($dom, $headerRow, 'Nbre de Formation Planifi');
 *   $patcher->setNumericCell($dom, $col . $targetRow, 5);
 *   $patcher->saveSheetDom($sheetPath, $dom);
 *   $patcher->forceFullRecalcOnLoad();
 *   $patcher->close();
 */
class XlsxSurgicalPatcher
{
    private ZipArchive $zip;
    private string $path;

    /** @var array<int,string>|null */
    private ?array $sharedStrings = null;

    private function __construct(string $path)
    {
        $this->path = $path;
        $this->zip = new ZipArchive();
        if ($this->zip->open($path) !== true) {
            throw new RuntimeException("Impossible d'ouvrir l'archive xlsx : {$path}");
        }
    }

    public static function openCopy(string $sourcePath, string $destinationPath): self
    {
        if (! is_file($sourcePath)) {
            throw new RuntimeException("Modèle introuvable : {$sourcePath}");
        }
        if (! copy($sourcePath, $destinationPath)) {
            throw new RuntimeException("Impossible de copier le modèle vers : {$destinationPath}");
        }

        return new self($destinationPath);
    }

    /**
     * @return array<int,string> nom de feuille => chemin XML interne (ex: xl/worksheets/sheet8.xml)
     */
    public function listSheets(): array
    {
        $workbookXml = $this->zip->getFromName('xl/workbook.xml');
        $relsXml = $this->zip->getFromName('xl/_rels/workbook.xml.rels');
        if ($workbookXml === false || $relsXml === false) {
            throw new RuntimeException('xl/workbook.xml ou ses relations sont introuvables.');
        }

        $relsDom = new \DOMDocument();
        $relsDom->loadXML($relsXml);
        $ridToTarget = [];
        foreach ($relsDom->getElementsByTagName('Relationship') as $rel) {
            $ridToTarget[$rel->getAttribute('Id')] = $rel->getAttribute('Target');
        }

        $wbDom = new \DOMDocument();
        $wbDom->loadXML($workbookXml);
        $result = [];
        foreach ($wbDom->getElementsByTagName('sheet') as $sheet) {
            $name = $sheet->getAttribute('name');
            $rId = $sheet->getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
            $target = $ridToTarget[$rId] ?? null;
            if ($target) {
                $result[$name] = 'xl/' . ltrim($target, '/');
            }
        }

        return $result;
    }

    public function sheetXmlPathFor(string $sheetName): string
    {
        $sheets = $this->listSheets();
        foreach ($sheets as $name => $path) {
            if (trim($name) === trim($sheetName)) {
                return $path;
            }
        }

        throw new RuntimeException("Feuille introuvable : {$sheetName}");
    }

    public function loadSheetDom(string $sheetXmlPath): \DOMDocument
    {
        $xml = $this->zip->getFromName($sheetXmlPath);
        if ($xml === false) {
            throw new RuntimeException("Partie XML introuvable dans l'archive : {$sheetXmlPath}");
        }
        $dom = new \DOMDocument();
        $dom->preserveWhiteSpace = true;
        $dom->loadXML($xml);

        return $dom;
    }

    public function saveSheetDom(string $sheetXmlPath, \DOMDocument $dom): void
    {
        if (! $this->zip->addFromString($sheetXmlPath, $dom->saveXML())) {
            throw new RuntimeException("Impossible d'écrire la partie modifiée : {$sheetXmlPath}");
        }
    }

    /** @return array<int,string> index => texte */
    private function sharedStrings(): array
    {
        if ($this->sharedStrings !== null) {
            return $this->sharedStrings;
        }

        $xml = $this->zip->getFromName('xl/sharedStrings.xml');
        $this->sharedStrings = [];
        if ($xml === false) {
            return $this->sharedStrings;
        }

        $dom = new \DOMDocument();
        $dom->loadXML($xml);
        $i = 0;
        foreach ($dom->getElementsByTagName('si') as $si) {
            $this->sharedStrings[$i] = trim($si->textContent);
            $i++;
        }

        return $this->sharedStrings;
    }

    private function cellText(\DOMElement $cell): string
    {
        $type = $cell->getAttribute('t');
        if ($type === 's') {
            $vNode = $cell->getElementsByTagName('v')->item(0);
            $idx = $vNode ? (int) $vNode->textContent : -1;

            return $this->sharedStrings()[$idx] ?? '';
        }
        if ($type === 'inlineStr') {
            $isNode = $cell->getElementsByTagName('is')->item(0);

            return $isNode ? trim($isNode->textContent) : '';
        }
        $vNode = $cell->getElementsByTagName('v')->item(0);

        return $vNode ? trim($vNode->textContent) : '';
    }

    private function normalize(string $s): string
    {
        $s = str_replace(
            ['é', 'è', 'ê', 'ë', 'à', 'â', 'î', 'ï', 'ô', 'û', 'ù', 'ç'],
            ['e', 'e', 'e', 'e', 'a', 'a', 'i', 'i', 'o', 'u', 'u', 'c'],
            mb_strtolower($s)
        );

        return trim($s);
    }

    private function colLettersFromRef(string $cellRef): string
    {
        preg_match('/^([A-Z]+)(\d+)$/', $cellRef, $m);

        return $m[1] ?? '';
    }

    private function rowNumberFromRef(string $cellRef): int
    {
        preg_match('/^([A-Z]+)(\d+)$/', $cellRef, $m);

        return isset($m[2]) ? (int) $m[2] : 0;
    }

    private function colLetterToIndex(string $col): int
    {
        $index = 0;
        foreach (str_split($col) as $char) {
            $index = $index * 26 + (ord($char) - ord('A') + 1);
        }

        return $index;
    }

    /**
     * Cherche une cellule contenant $needle (insensible casse/accents,
     * correspondance partielle) et retourne son numéro de ligne, ou null.
     */
    public function findHeaderRow(\DOMDocument $dom, string $needle): ?int
    {
        $needle = $this->normalize($needle);
        foreach ($dom->getElementsByTagName('c') as $cell) {
            /** @var \DOMElement $cell */
            $text = $this->normalize($this->cellText($cell));
            if ($text !== '' && str_contains($text, $needle)) {
                return $this->rowNumberFromRef($cell->getAttribute('r'));
            }
        }

        return null;
    }

    /**
     * Cherche $needle uniquement dans la ligne $rowNumber, retourne la
     * lettre de colonne trouvée, ou null.
     */
    public function findColInRow(\DOMDocument $dom, int $rowNumber, string $needle): ?string
    {
        $needle = $this->normalize($needle);
        $row = $this->findRowElement($dom, $rowNumber);
        if ($row === null) {
            return null;
        }

        foreach ($row->getElementsByTagName('c') as $cell) {
            /** @var \DOMElement $cell */
            $text = $this->normalize($this->cellText($cell));
            if ($text !== '' && str_contains($text, $needle)) {
                return $this->colLettersFromRef($cell->getAttribute('r'));
            }
        }

        return null;
    }

    /**
     * Trouve, sous la ligne d'en-tête, la ligne dont la colonne $labelCol
     * contient la valeur numérique $year exactement.
     */
    public function findRowByYear(\DOMDocument $dom, int $headerRow, string $labelCol, int $year, int $maxScan = 30): ?int
    {
        for ($rowNum = $headerRow + 1; $rowNum <= $headerRow + $maxScan; $rowNum++) {
            $row = $this->findRowElement($dom, $rowNum);
            if ($row === null) {
                continue;
            }
            foreach ($row->getElementsByTagName('c') as $cell) {
                /** @var \DOMElement $cell */
                if ($this->colLettersFromRef($cell->getAttribute('r')) === $labelCol) {
                    $vNode = $cell->getElementsByTagName('v')->item(0);
                    if ($vNode !== null && (int) trim($vNode->textContent) === $year) {
                        return $rowNum;
                    }
                    break;
                }
            }
        }

        return null;
    }

    /**
     * Dernière ligne du bloc CONTIGU commençant à $afterRow+1 possédant une
     * valeur non vide dans $col (s'arrête au premier "trou" — n'examine pas
     * tout le reste de la feuille, où la même lettre de colonne peut être
     * réutilisée par d'autres tableaux plus bas).
     */
    public function lastRowWithValue(\DOMDocument $dom, string $col, int $afterRow, int $maxScan = 30): int
    {
        $last = $afterRow;
        for ($rowNum = $afterRow + 1; $rowNum <= $afterRow + $maxScan; $rowNum++) {
            $row = $this->findRowElement($dom, $rowNum);
            if ($row === null) {
                break;
            }
            $hasValue = false;
            foreach ($row->getElementsByTagName('c') as $cell) {
                /** @var \DOMElement $cell */
                if ($this->colLettersFromRef($cell->getAttribute('r')) === $col) {
                    $vNode = $cell->getElementsByTagName('v')->item(0);
                    if ($vNode !== null && trim($vNode->textContent) !== '') {
                        $hasValue = true;
                    }
                    break;
                }
            }
            if (! $hasValue) {
                break;
            }
            $last = $rowNum;
        }

        return $last;
    }

    private function findRowElement(\DOMDocument $dom, int $rowNumber): ?\DOMElement
    {
        $sheetData = $dom->getElementsByTagName('sheetData')->item(0);
        if ($sheetData === null) {
            return null;
        }
        foreach ($sheetData->getElementsByTagName('row') as $row) {
            /** @var \DOMElement $row */
            if ((int) $row->getAttribute('r') === $rowNumber) {
                return $row;
            }
        }

        return null;
    }

    /**
     * Écrit une valeur numérique dans $cellRef (ex: "F222"), en créant la
     * cellule si elle n'existe pas encore. Ne touche jamais une cellule
     * contenant une formule (<f>) — lève une exception dans ce cas pour
     * éviter d'écraser un calcul par erreur.
     */
    public function setNumericCell(\DOMDocument $dom, string $cellRef, $value): void
    {
        $rowNumber = $this->rowNumberFromRef($cellRef);
        $col = $this->colLettersFromRef($cellRef);
        $row = $this->findRowElement($dom, $rowNumber);
        if ($row === null) {
            throw new RuntimeException("Ligne {$rowNumber} introuvable pour la cellule {$cellRef}.");
        }

        $existing = null;
        foreach ($row->getElementsByTagName('c') as $cell) {
            /** @var \DOMElement $cell */
            if ($cell->getAttribute('r') === $cellRef) {
                $existing = $cell;
                break;
            }
        }

        if ($existing !== null) {
            if ($existing->getElementsByTagName('f')->length > 0) {
                throw new RuntimeException("Refus d'écraser une formule dans {$cellRef}.");
            }
            $existing->removeAttribute('t');
            $vNode = $existing->getElementsByTagName('v')->item(0);
            if ($vNode === null) {
                $vNode = $dom->createElement('v');
                $existing->appendChild($vNode);
            }
            $vNode->nodeValue = (string) $value;

            return;
        }

        // La cellule n'existe pas encore dans ce XML : la créer à la bonne position.
        $newCell = $dom->createElement('c');
        $newCell->setAttribute('r', $cellRef);
        $vNode = $dom->createElement('v', (string) $value);
        $newCell->appendChild($vNode);

        $targetIndex = $this->colLetterToIndex($col);
        $inserted = false;
        foreach ($row->getElementsByTagName('c') as $cell) {
            /** @var \DOMElement $cell */
            $existingIndex = $this->colLetterToIndex($this->colLettersFromRef($cell->getAttribute('r')));
            if ($existingIndex > $targetIndex) {
                $row->insertBefore($newCell, $cell);
                $inserted = true;
                break;
            }
        }
        if (! $inserted) {
            $row->appendChild($newCell);
        }
    }

    /**
     * Force Excel à tout recalculer à l'ouverture (indispensable : les
     * graphiques lisent des colonnes de taux calculées par formule à partir
     * des cellules qu'on vient de modifier).
     */
    public function forceFullRecalcOnLoad(): void
    {
        $xml = $this->zip->getFromName('xl/workbook.xml');
        if ($xml === false) {
            return;
        }
        $dom = new \DOMDocument();
        $dom->loadXML($xml);

        $calcPr = $dom->getElementsByTagName('calcPr')->item(0);
        if ($calcPr === null) {
            $calcPr = $dom->createElement('calcPr');
            $dom->documentElement->appendChild($calcPr);
        }
        $calcPr->setAttribute('fullCalcOnLoad', '1');

        $this->zip->addFromString('xl/workbook.xml', $dom->saveXML());
    }

    public function close(): void
    {
        $this->zip->close();
    }
}
