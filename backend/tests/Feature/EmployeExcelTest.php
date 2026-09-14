<?php

namespace Tests\Feature;

use App\Models\Employe;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use Tests\TestCase;

class EmployeExcelTest extends TestCase
{
    use RefreshDatabase;

    public function test_bulk_sync_accepts_text_identifiers_and_numeric_strings(): void
    {
        $this->withoutMiddleware();

        $response = $this->postJson('/api/employes/bulk-sync', [
            'employes' => [[
                'matricule' => '000123',
                'nom' => 'DOE',
                'prenom' => 'Jane',
                'date_embauche' => '2020-01-15',
                'solde_conge' => '12',
                'entite' => 'Navigation Aérienne',
            ]],
        ]);

        $response->assertOk()
            ->assertJsonPath('created', 1)
            ->assertJsonPath('modified', 0)
            ->assertJsonPath('unchanged', 0);

        $this->assertDatabaseHas('employe', [
            'matricule' => '000123',
            'solde_conge' => 12,
        ]);
    }

    public function test_bulk_sync_reports_indexed_field_validation_errors(): void
    {
        $this->withoutMiddleware();

        $response = $this->postJson('/api/employes/bulk-sync', [
            'employes' => [[
                'matricule' => '000123',
                'sexe' => 'X',
            ]],
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors([
                'employes.0.nom',
                'employes.0.prenom',
                'employes.0.sexe',
            ]);
    }

    public function test_export_writes_text_identifiers_and_numeric_balance(): void
    {
        $this->withoutMiddleware();

        Employe::create([
            'matricule' => '000123',
            'nom' => 'DOE',
            'prenom' => 'Jane',
            'sexe' => 'F',
            'date_embauche' => '2020-01-15',
            'solde_conge' => 12.5,
            'observation' => 'RAS',
        ]);

        $response = $this->get('/api/employes/export');
        $response->assertOk();

        $sheet = $this->loadSheet($response);

        $this->assertSame('Matricule', $sheet->getCell('A1')->getValue());
        $this->assertSame('Solde congé (j)', $sheet->getCell('Q1')->getValue());
        $this->assertSame('Observation', $sheet->getCell('R1')->getValue());

        $matricule = $sheet->getCell('A2');
        $this->assertSame(DataType::TYPE_STRING, $matricule->getDataType());
        $this->assertSame('000123', $matricule->getValue());

        $observation = $sheet->getCell('R2');
        $this->assertSame(DataType::TYPE_STRING, $observation->getDataType());
        $this->assertSame('RAS', $observation->getValue());

        $solde = $sheet->getCell('Q2');
        $this->assertSame(DataType::TYPE_NUMERIC, $solde->getDataType());
        $this->assertSame(12.5, $solde->getValue());
    }

    public function test_export_without_employees_still_contains_headers(): void
    {
        $this->withoutMiddleware();

        $response = $this->get('/api/employes/export');
        $response->assertOk();

        $sheet = $this->loadSheet($response);

        $this->assertSame('Matricule', $sheet->getCell('A1')->getValue());
        $this->assertSame('Observation', $sheet->getCell('R1')->getValue());
        $this->assertNull($sheet->getCell('A2')->getValue());
    }

    public function test_bulk_sync_replace_deletes_employees_absent_from_the_file(): void
    {
        $this->withoutMiddleware();

        Employe::create(['matricule' => 'KEEP01', 'nom' => 'DOE', 'prenom' => 'Jane']);
        Employe::create(['matricule' => 'DROP01', 'nom' => 'ROE', 'prenom' => 'John']);

        $response = $this->postJson('/api/employes/bulk-sync', [
            'replace' => true,
            'employes' => [[
                'matricule' => 'KEEP01',
                'nom' => 'DOE',
                'prenom' => 'Jane',
            ]],
        ]);

        $response->assertOk()
            ->assertJsonPath('deleted', 1)
            ->assertJsonPath('unchanged', 1);

        $this->assertDatabaseHas('employe', ['matricule' => 'KEEP01']);
        $this->assertDatabaseMissing('employe', ['matricule' => 'DROP01']);
    }

    public function test_bulk_sync_without_replace_keeps_employees_absent_from_the_file(): void
    {
        $this->withoutMiddleware();

        Employe::create(['matricule' => 'DROP01', 'nom' => 'ROE', 'prenom' => 'John']);

        $response = $this->postJson('/api/employes/bulk-sync', [
            'employes' => [[
                'matricule' => 'KEEP01',
                'nom' => 'DOE',
                'prenom' => 'Jane',
            ]],
        ]);

        $response->assertOk()->assertJsonPath('deleted', 0);

        $this->assertDatabaseHas('employe', ['matricule' => 'DROP01']);
        $this->assertDatabaseHas('employe', ['matricule' => 'KEEP01']);
    }

    private function loadSheet(TestResponse $response): Worksheet
    {
        $path = tempnam(sys_get_temp_dir(), 'employes-xlsx-');
        file_put_contents($path, $response->streamedContent());

        $spreadsheet = IOFactory::load($path);
        $sheet = $spreadsheet->getActiveSheet();
        @unlink($path);

        return $sheet;
    }
}
