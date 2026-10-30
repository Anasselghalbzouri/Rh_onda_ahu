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

    /** @var array<string,string> parties modifiées : ZipArchive::getFromName relit l'archive d'origine avant close() */
    private array $modifiees = [];

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
        $workbookXml = $this->lire('xl/workbook.xml');
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
        $xml = $this->lire($sheetXmlPath);
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
        $this->ecrire($sheetXmlPath, $dom->saveXML());
    }

    private function lire(string $partie): string|false
    {
        return $this->modifiees[$partie] ?? $this->zip->getFromName($partie);
    }

    private function ecrire(string $partie, string $xml): void
    {
        if (! $this->zip->addFromString($partie, $xml)) {
            throw new RuntimeException("Impossible d'écrire la partie modifiée : {$partie}");
        }
        $this->modifiees[$partie] = $xml;
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
     * Première ligne (>= $fromRow) dont la cellule de la colonne $col contient
     * $needle. Limiter la colonne évite qu'un mot d'un commentaire (colonne I)
     * soit pris pour un titre de section (colonne B).
     */
    public function findRowInCol(\DOMDocument $dom, string $col, string $needle, int $fromRow = 1): ?int
    {
        $needle = $this->normalize($needle);
        foreach ($dom->getElementsByTagName('c') as $cell) {
            /** @var \DOMElement $cell */
            $ref = $cell->getAttribute('r');
            if ($this->colLettersFromRef($ref) !== $col || $this->rowNumberFromRef($ref) < $fromRow) {
                continue;
            }
            if (str_contains($this->normalize($this->cellText($cell)), $needle)) {
                return $this->rowNumberFromRef($ref);
            }
        }

        return null;
    }

    /** Titre de section : texte de la colonne B qui COMMENCE par $prefix (ex. « I.F », « IV.c »). */
    public function findTitleRow(\DOMDocument $dom, string $prefix): ?int
    {
        $prefix = $this->normalize($prefix);
        foreach ($dom->getElementsByTagName('c') as $cell) {
            /** @var \DOMElement $cell */
            $ref = $cell->getAttribute('r');
            if ($this->colLettersFromRef($ref) === 'B' && str_starts_with($this->normalize($this->cellText($cell)), $prefix)) {
                return $this->rowNumberFromRef($ref);
            }
        }

        return null;
    }

    /** Colonne de la ligne $rowNumber dont le texte normalisé correspond à $regex. */
    public function findColInRowMatching(\DOMDocument $dom, int $rowNumber, string $regex): ?string
    {
        $row = $this->findRowElement($dom, $rowNumber);
        foreach ($row?->getElementsByTagName('c') ?? [] as $cell) {
            /** @var \DOMElement $cell */
            if (preg_match($regex, $this->normalize($this->cellText($cell)))) {
                return $this->colLettersFromRef($cell->getAttribute('r'));
            }
        }

        return null;
    }

    /**
     * Écrit un texte dans $cellRef en chaîne « inline » (pas de table de
     * chaînes partagées à modifier). Même garde anti-formule que setNumericCell.
     */
    public function setTextCell(\DOMDocument $dom, string $cellRef, string $text): void
    {
        $this->setNumericCell($dom, $cellRef, 0); // crée/positionne la cellule et vérifie l'absence de formule
        foreach ($this->findRowElement($dom, $this->rowNumberFromRef($cellRef))->getElementsByTagName('c') as $cell) {
            /** @var \DOMElement $cell */
            if ($cell->getAttribute('r') !== $cellRef) {
                continue;
            }
            while ($cell->firstChild) {
                $cell->removeChild($cell->firstChild);
            }
            $cell->setAttribute('t', 'inlineStr');
            $t = $dom->createElement('t');
            $t->setAttribute('xml:space', 'preserve');
            // createTextNode échappe & et < (createElement($nom, $valeur) ne le fait pas).
            $t->appendChild($dom->createTextNode($text));
            $is = $dom->createElement('is');
            $is->appendChild($t);
            $cell->appendChild($is);

            return;
        }
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
        $xml = $this->lire('xl/workbook.xml');
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

        $this->ecrire('xl/workbook.xml', $dom->saveXML());
    }

    /** Valeur affichée de $cellRef (chaîne partagée, texte en ligne ou nombre), null si absente ou vide. */
    public function cellValue(\DOMDocument $dom, string $cellRef): ?string
    {
        $cell = $this->findCell($dom, $cellRef);
        $text = $cell ? $this->cellText($cell) : '';

        return $text === '' ? null : $text;
    }

    /** Vide une cellule en gardant son style ; une formule n'est jamais touchée. */
    public function clearCell(\DOMDocument $dom, string $cellRef): void
    {
        $cell = $this->findCell($dom, $cellRef);
        if ($cell === null || $cell->getElementsByTagName('f')->length > 0) {
            return;
        }
        while ($cell->firstChild) {
            $cell->removeChild($cell->firstChild);
        }
        $cell->removeAttribute('t');
    }

    private function findCell(\DOMDocument $dom, string $cellRef): ?\DOMElement
    {
        foreach ($this->findRowElement($dom, $this->rowNumberFromRef($cellRef))?->getElementsByTagName('c') ?? [] as $cell) {
            /** @var \DOMElement $cell */
            if ($cell->getAttribute('r') === $cellRef) {
                return $cell;
            }
        }

        return null;
    }

    /**
     * Renomme une feuille et toutes les références « 'Nom'!A1 » du classeur
     * (zones d'impression, graphiques, formules).
     */
    public function renameSheet(string $ancien, string $nouveau): void
    {
        if (mb_strlen($nouveau) > 31) {
            throw new RuntimeException("Nom de feuille trop long (31 caractères maximum) : {$nouveau}");
        }

        $wb = new \DOMDocument();
        $wb->loadXML($this->lire('xl/workbook.xml'));
        foreach ($wb->getElementsByTagName('sheet') as $sheet) {
            /** @var \DOMElement $sheet */
            if ($sheet->getAttribute('name') === $ancien) {
                $sheet->setAttribute('name', $nouveau);
            }
        }
        $this->ecrire('xl/workbook.xml', $wb->saveXML());

        $ref = fn (string $nom) => htmlspecialchars("'".str_replace("'", "''", $nom)."'!", ENT_NOQUOTES | ENT_XML1);
        $remplacements = [$ref($ancien) => $ref($nouveau)];
        if (preg_match('/^\w+$/u', $ancien)) {
            // Nom sans espace : Excel l'écrit aussi sans apostrophes (Feuil1!A1).
            $remplacements['>'.$ancien.'!'] = '>'.$ref($nouveau);
        }
        for ($i = 0; $i < $this->zip->numFiles; $i++) {
            $partie = $this->zip->getNameIndex($i);
            if (preg_match('#^xl/(workbook\.xml|charts/[^/]+\.xml|worksheets/[^/]+\.xml)$#', $partie)) {
                $xml = $this->lire($partie);
                $nouveauXml = strtr($xml, $remplacements);
                if ($nouveauXml !== $xml) {
                    $this->ecrire($partie, $nouveauXml);
                }
            }
        }
    }

    /** Cache toutes les autres feuilles et ouvre le classeur sur $nom. */
    public function showOnlySheet(string $nom): void
    {
        $sheets = $this->listSheets();
        $wb = new \DOMDocument();
        $wb->loadXML($this->lire('xl/workbook.xml'));
        $index = 0;
        foreach ($wb->getElementsByTagName('sheet') as $i => $sheet) {
            /** @var \DOMElement $sheet */
            if ($sheet->getAttribute('name') === $nom) {
                $sheet->removeAttribute('state');
                $index = $i;
            } else {
                $sheet->setAttribute('state', 'hidden');
            }
        }
        foreach ($wb->getElementsByTagName('workbookView') as $vue) {
            /** @var \DOMElement $vue */
            $vue->setAttribute('activeTab', (string) $index);
            $vue->setAttribute('firstSheet', (string) $index);
        }
        $this->ecrire('xl/workbook.xml', $wb->saveXML());

        foreach ($sheets as $nomFeuille => $partie) {
            $dom = $this->loadSheetDom($partie);
            foreach ($dom->getElementsByTagName('sheetView') as $vue) {
                /** @var \DOMElement $vue */
                $nomFeuille === $nom ? $vue->setAttribute('tabSelected', '1') : $vue->removeAttribute('tabSelected');
            }
            $this->saveSheetDom($partie, $dom);
        }
    }

    public function close(): void
    {
        $this->zip->close();
    }
}
