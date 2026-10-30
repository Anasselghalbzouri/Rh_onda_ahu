<?php

namespace Tests\Feature;

use App\Exports\EmployeRapportExport;
use App\Models\Employe;
use App\Models\ResponsableRh;
use App\Models\Service;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use Tests\TestCase;

class RapportEmployesExportTest extends TestCase
{
    use RefreshDatabase;

    private function connecterRh(): void
    {
        $this->actingAs(ResponsableRh::forceCreate(['login' => 'rh', 'password' => bcrypt('x')]), 'rh');
    }

    private function employe(array $attributs = []): Employe
    {
        return Employe::forceCreate($attributs + [
            'matricule' => 'M'.uniqid(),
            'nom' => 'DOE',
            'prenom' => 'Jane',
            'solde_conge' => 12.5,
        ]);
    }

    private function exporter(string $requete): TestResponse
    {
        return $this->get('/api/rapport-employes/export?'.$requete);
    }

    /** @return array<int, array<int, mixed>> */
    private function lignes(TestResponse $response): array
    {
        return $this->feuille($response)->toArray(null, false, false);
    }

    private function feuille(TestResponse $response): Worksheet
    {
        $response->assertOk();
        $chemin = tempnam(sys_get_temp_dir(), 'rapport-employes-');
        file_put_contents($chemin, $response->streamedContent());
        $feuille = IOFactory::load($chemin)->getActiveSheet();
        @unlink($chemin);

        return $feuille;
    }

    public function test_dg_cannot_access_report(): void
    {
        $dg = ResponsableRh::forceCreate(['login' => 'dg', 'password' => bcrypt('x')]);
        $dg->setAttribute('role', 'dg');
        $this->actingAs($dg, 'rh');

        $this->getJson('/api/rapport-employes')->assertForbidden();
        $this->getJson('/api/rapport-employes/export?colonnes[]=nom')->assertForbidden();
    }

    public function test_guest_cannot_access_report(): void
    {
        $this->getJson('/api/rapport-employes')->assertUnauthorized();
        $this->getJson('/api/rapport-employes/export?colonnes[]=nom')->assertUnauthorized();
    }

    public function test_export_contains_only_requested_columns_in_catalogue_order(): void
    {
        $this->connecterRh();
        $this->employe(['nom' => 'ALAMI', 'statut' => 'actif']);

        $lignes = $this->lignes($this->exporter('colonnes[]=statut&colonnes[]=nom&colonnes[]=nom'));

        $this->assertSame([['Nom', 'Statut'], ['ALAMI', 'actif']], $lignes);
    }

    public function test_export_applies_filter_without_service_column(): void
    {
        $this->connecterRh();
        $service = Service::forceCreate(['nom' => 'Sûreté']);
        $this->employe(['nom' => 'GARDE', 'service_id' => $service->id]);
        $this->employe(['nom' => 'SORTI']);

        $lignes = $this->lignes($this->exporter("colonnes[]=nom&service_id={$service->id}"));

        $this->assertSame([['Nom'], ['GARDE']], $lignes);
    }

    public function test_export_sorts_by_name_then_first_name(): void
    {
        $this->connecterRh();
        $this->employe(['nom' => 'ZIANI', 'prenom' => 'Ali']);
        $this->employe(['nom' => 'ALAMI', 'prenom' => 'Sara']);
        $this->employe(['nom' => 'ALAMI', 'prenom' => 'Omar']);

        $lignes = $this->lignes($this->exporter('colonnes[]=nom&colonnes[]=prenom'));

        $this->assertSame([['ALAMI', 'Omar'], ['ALAMI', 'Sara'], ['ZIANI', 'Ali']], array_slice($lignes, 1));
    }

    public function test_export_formats_values(): void
    {
        $this->connecterRh();
        $this->employe([
            'matricule' => '000777',
            'date_embauche' => '2015-03-09',
            'observation' => '=1+1',
            'fonction' => null,
        ]);

        $feuille = $this->feuille($this->exporter(
            'colonnes[]=matricule&colonnes[]=date_embauche&colonnes[]=fonction&colonnes[]=service&colonnes[]=observation'
        ));

        $this->assertSame('000777', $feuille->getCell('A2')->getValue());
        $this->assertSame('09/03/2015', $feuille->getCell('B2')->getValue());
        $this->assertNull($feuille->getCell('C2')->getValue());
        $this->assertSame('Non renseigné', $feuille->getCell('D2')->getValue());
        // Une observation commençant par « = » ne doit pas devenir une formule dans Excel.
        $this->assertSame('=1+1', $feuille->getCell('E2')->getValue());
        $this->assertSame(DataType::TYPE_STRING, $feuille->getCell('E2')->getDataType());
    }

    public function test_export_rejects_missing_or_unknown_columns_in_french(): void
    {
        $this->connecterRh();

        $this->getJson('/api/rapport-employes/export')
            ->assertUnprocessable()
            ->assertJsonPath('errors.colonnes.0', 'Choisissez au moins une colonne à exporter.');

        $this->getJson('/api/rapport-employes/export?colonnes[]=salaire')
            ->assertJsonValidationErrors(['colonnes.0' => 'Colonne inconnue.']);
    }

    public function test_preview_without_columns_returns_catalogue_but_no_employee_data(): void
    {
        $this->connecterRh();
        $this->employe(['nom' => 'CONFIDENTIEL', 'statut' => 'actif']);
        $this->employe(['nom' => 'AUTRE', 'statut' => 'parti']);

        $response = $this->getJson('/api/rapport-employes?statut=actif')
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('lignes', [])
            ->assertJsonCount(19, 'colonnes')
            ->assertJsonPath('colonnes.0', ['key' => 'matricule', 'label' => 'Matricule'])
            ->assertJsonPath('colonnes.18', ['key' => 'observation', 'label' => 'Observation']);

        $this->assertStringNotContainsString('CONFIDENTIEL', $response->getContent());
    }

    public function test_preview_returns_filtered_employees_with_requested_columns_only(): void
    {
        $this->connecterRh();
        $service = Service::forceCreate(['nom' => 'Sûreté']);
        $this->employe(['nom' => 'ZIANI', 'prenom' => 'Ali', 'service_id' => $service->id, 'solde_conge' => 20]);
        $this->employe(['nom' => 'ALAMI', 'prenom' => 'Sara', 'service_id' => $service->id, 'solde_conge' => 21]);
        $this->employe(['nom' => 'SORTI', 'prenom' => 'Hors', 'solde_conge' => 22]);

        $response = $this->getJson("/api/rapport-employes?service_id={$service->id}&colonnes[]=prenom&colonnes[]=nom")
            ->assertOk()
            ->assertJsonPath('total', 2)
            ->assertJsonPath('lignes', [
                ['nom' => 'ALAMI', 'prenom' => 'Sara'],
                ['nom' => 'ZIANI', 'prenom' => 'Ali'],
            ]);

        $this->assertStringNotContainsString('solde_conge":2', $response->getContent());
    }

    public function test_preview_rejects_unknown_column_in_french(): void
    {
        $this->connecterRh();

        $this->getJson('/api/rapport-employes?colonnes[]=salaire')
            ->assertJsonValidationErrors(['colonnes.0' => 'Colonne inconnue.']);
    }

    public function test_preview_rows_match_file_rows(): void
    {
        $this->connecterRh();
        $this->employe([
            'matricule' => '000777',
            'nom' => 'ALAMI',
            'date_embauche' => '2015-03-09',
            'solde_conge' => 12.5,
        ]);

        $requete = 'colonnes[]=matricule&colonnes[]=nom&colonnes[]=date_embauche&colonnes[]=service&colonnes[]=solde_conge';
        $ligne = $this->getJson('/api/rapport-employes?'.$requete)->json('lignes.0');
        $fichier = $this->lignes($this->exporter($requete));

        $this->assertSame(['000777', 'ALAMI', '09/03/2015', 'Non renseigné', 12.5], array_values($ligne));
        $this->assertSame(array_values($ligne), $fichier[1]);
    }

    public function test_file_has_as_many_rows_as_preview_total(): void
    {
        $this->connecterRh();
        $this->employe(['statut' => 'actif']);
        $this->employe(['statut' => 'actif']);
        $this->employe(['statut' => 'parti']);

        $total = $this->getJson('/api/rapport-employes?statut=actif')->json('total');
        $lignes = $this->lignes($this->exporter('colonnes[]=nom&statut=actif'));

        $this->assertCount($total + 1, $lignes);
    }

    public function test_leave_balance_is_exported_only_when_requested(): void
    {
        $this->connecterRh();
        $this->employe(['solde_conge' => 12.5]);

        $sans = $this->lignes($this->exporter('colonnes[]=nom'));
        $this->assertSame([['Nom'], ['DOE']], $sans);

        $feuille = $this->feuille($this->exporter('colonnes[]=nom&colonnes[]=solde_conge'));
        $this->assertSame('Solde congé (j)', $feuille->getCell('B1')->getValue());
        $this->assertSame(12.5, $feuille->getCell('B2')->getValue());
        $this->assertSame(DataType::TYPE_NUMERIC, $feuille->getCell('B2')->getDataType());
    }

    public function test_catalogue_excludes_sick_leave_absences_and_leave_requests(): void
    {
        $cles = implode(' ', array_keys(EmployeRapportExport::COLONNES));

        $this->assertDoesNotMatchRegularExpression('/maladie|absence|demande|salaire|cin/i', $cles);
    }
}
