<?php

namespace Tests\Unit;

use App\Services\XlsxSurgicalPatcher;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PHPUnit\Framework\TestCase;

/** Spec 006 : lecture, effacement, renommage et masquage des feuilles. */
class XlsxSurgicalPatcherTest extends TestCase
{
    private string $source;

    private string $copie;

    protected function setUp(): void
    {
        parent::setUp();
        $this->source = tempnam(sys_get_temp_dir(), 'ps09').'.xlsx';
        $this->copie = tempnam(sys_get_temp_dir(), 'ps09').'.xlsx';

        $wb = new Spreadsheet();
        $wb->getActiveSheet()->setTitle('E3 Rap Act Sep 2025')->setCellValue('A1', 'ancienne');
        $ws = $wb->createSheet()->setTitle('Gabarit');
        $ws->setCellValue('C2', 'texte')->setCellValue('C3', 5)->setCellValue('D3', '=C3*2');
        $ws->getPageSetup()->setPrintArea('A1:N20');
        (new Xlsx($wb))->save($this->source);

        $zip = new \ZipArchive();
        $zip->open($this->source);
        $zip->addFromString('xl/charts/chart1.xml', "<c:chartSpace><c:f>Gabarit!\$C\$2:\$C\$3</c:f><c:f>'E3 Rap Act Sep 2025'!\$A\$1</c:f></c:chartSpace>");
        $zip->close();
    }

    protected function tearDown(): void
    {
        @unlink($this->source);
        @unlink($this->copie);
        parent::tearDown();
    }

    public function test_lire_et_vider_sans_toucher_les_formules(): void
    {
        $p = XlsxSurgicalPatcher::openCopy($this->source, $this->copie);
        $dom = $p->loadSheetDom($p->sheetXmlPathFor('Gabarit'));

        $this->assertSame('texte', $p->cellValue($dom, 'C2'));
        $this->assertSame('5', $p->cellValue($dom, 'C3'));
        $this->assertNull($p->cellValue($dom, 'Z9'));

        $p->setTextCell($dom, 'E3', 'en ligne');
        $this->assertSame('en ligne', $p->cellValue($dom, 'E3'));

        $p->clearCell($dom, 'C3');
        $p->clearCell($dom, 'D3');
        $this->assertNull($p->cellValue($dom, 'C3'));
        $this->assertSame(1, $dom->getElementsByTagName('f')->length);
        $p->close();
    }

    public function test_renommer_et_ne_montrer_qu_une_feuille(): void
    {
        $p = XlsxSurgicalPatcher::openCopy($this->source, $this->copie);
        $p->renameSheet('E3 Rap Act Sep 2025', 'E3 Rap Act Sep 2025 (archive)');
        $p->renameSheet('Gabarit', 'E3 Rap Act Sep 2025');
        $p->showOnlySheet('E3 Rap Act Sep 2025');
        $p->close();

        $zip = new \ZipArchive();
        $zip->open($this->copie);
        $chart = $zip->getFromName('xl/charts/chart1.xml');
        $workbook = $zip->getFromName('xl/workbook.xml');
        $zip->close();

        $this->assertStringContainsString("'E3 Rap Act Sep 2025'!\$C\$2:\$C\$3", $chart);
        $this->assertStringContainsString("'E3 Rap Act Sep 2025 (archive)'!\$A\$1", $chart);
        $this->assertStringContainsString("'E3 Rap Act Sep 2025'!\$A\$1:\$N\$20", $workbook);
        $this->assertMatchesRegularExpression('/activeTab="1"/', $workbook);

        $wb = IOFactory::load($this->copie);
        $this->assertSame('hidden', $wb->getSheetByName('E3 Rap Act Sep 2025 (archive)')->getSheetState());
        $this->assertSame('ancienne', $wb->getSheetByName('E3 Rap Act Sep 2025 (archive)')->getCell('A1')->getValue());
        $this->assertSame('visible', $wb->getSheetByName('E3 Rap Act Sep 2025')->getSheetState());
        $this->assertSame('texte', $wb->getSheetByName('E3 Rap Act Sep 2025')->getCell('C2')->getValue());

        $zip->open($this->copie);
        $this->assertStringNotContainsString('tabSelected="1"', $zip->getFromName('xl/worksheets/sheet1.xml'));
        $this->assertStringContainsString('tabSelected="1"', $zip->getFromName('xl/worksheets/sheet2.xml'));
        $zip->close();
    }

    public function test_nom_trop_long_refuse(): void
    {
        $p = XlsxSurgicalPatcher::openCopy($this->source, $this->copie);
        $this->expectException(\RuntimeException::class);
        try {
            $p->renameSheet('Gabarit', str_repeat('x', 32));
        } finally {
            $p->close();
        }
    }
}
