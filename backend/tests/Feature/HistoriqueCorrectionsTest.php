<?php

namespace Tests\Feature;

use App\Models\Employe;
use App\Models\HistoriqueProfessionnel;
use App\Models\ResponsableRh;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class HistoriqueCorrectionsTest extends TestCase
{
    use RefreshDatabase;

    private Employe $employe;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-10-27');

        $this->employe = Employe::withoutEvents(fn () => Employe::forceCreate([
            'matricule' => '000888',
            'nom' => 'DOE',
            'prenom' => 'John',
            'statut' => 'actif',
        ]));

        $this->actingAs(ResponsableRh::forceCreate(['login' => 'rh', 'password' => bcrypt('x')]), 'rh');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function periode(?string $debut, ?string $fin, string $poste = 'Agent'): HistoriqueProfessionnel
    {
        return HistoriqueProfessionnel::forceCreate([
            'employe_id' => $this->employe->id,
            'poste' => $poste,
            'date_debut' => $debut,
            'date_fin' => $fin,
        ]);
    }

    public function test_store_closed_period(): void
    {
        $this->postJson("/api/employes/{$this->employe->id}/historique", [
            'poste' => 'Technicien',
            'echelle' => '9',
            'date_debut' => '2015-01-01',
            'date_fin' => '2018-12-31',
        ])->assertCreated()->assertJsonPath('poste', 'Technicien');

        $this->assertDatabaseHas('historique_professionnel', ['employe_id' => $this->employe->id, 'poste' => 'Technicien']);
    }

    public function test_store_rejects_fin_before_debut(): void
    {
        $this->postJson("/api/employes/{$this->employe->id}/historique", [
            'date_debut' => '2018-01-01',
            'date_fin' => '2017-01-01',
        ])->assertStatus(422)
            ->assertJsonPath('errors.date_fin.0', 'La date de fin doit être postérieure ou égale à la date de début.');
    }

    public function test_store_rejects_overlap(): void
    {
        $this->periode('2019-03-01', null);

        $this->postJson("/api/employes/{$this->employe->id}/historique", [
            'date_debut' => '2018-01-01',
            'date_fin' => '2019-06-30',
        ])->assertStatus(422)
            ->assertJsonPath('errors.date_debut.0', 'Cette période chevauche la période du 01/03/2019 au 27/10/2026.');
    }

    public function test_store_requires_date_fin(): void
    {
        $this->postJson("/api/employes/{$this->employe->id}/historique", [
            'date_debut' => '2018-01-01',
        ])->assertStatus(422)->assertJsonValidationErrors('date_fin');
    }

    public function test_update_contiguous_period_is_allowed(): void
    {
        $close = $this->periode('2019-03-01', '2026-10-27', 'Agent');
        $this->periode('2026-10-27', null, 'Chef');

        $this->putJson("/api/historique/{$close->id}", [
            'poste' => 'Agent principal',
            'date_debut' => '2019-03-01',
            'date_fin' => '2026-10-27',
        ])->assertOk()->assertJsonPath('poste', 'Agent principal');
    }

    public function test_update_open_period_only_changes_date_debut(): void
    {
        $ouverte = $this->periode('2026-10-27', null, 'Chef');

        $this->putJson("/api/historique/{$ouverte->id}", [
            'poste' => 'Autre',
            'date_debut' => '2026-01-01',
        ])->assertOk();

        $ouverte->refresh();
        $this->assertSame('Chef', $ouverte->poste);
        $this->assertSame('2026-01-01', $ouverte->date_debut->toDateString());
        $this->assertNull($ouverte->date_fin);
    }

    public function test_destroy_closed_ok_and_open_refused(): void
    {
        $close = $this->periode('2010-01-01', '2012-01-01');
        $ouverte = $this->periode('2020-01-01', null);

        $this->deleteJson("/api/historique/{$close->id}")->assertOk();
        $this->assertDatabaseMissing('historique_professionnel', ['id' => $close->id]);

        $this->deleteJson("/api/historique/{$ouverte->id}")->assertStatus(422)
            ->assertJsonPath('errors.periode.0', 'La période en cours reflète la situation actuelle et ne peut pas être supprimée.');
        $this->assertDatabaseHas('historique_professionnel', ['id' => $ouverte->id]);
    }

    public function test_dg_cannot_write(): void
    {
        $dg = ResponsableRh::forceCreate(['login' => 'dg', 'password' => bcrypt('x')]);
        $dg->setAttribute('role', 'dg');
        $this->actingAs($dg, 'rh');

        $this->postJson("/api/employes/{$this->employe->id}/historique", [
            'date_debut' => '2015-01-01',
            'date_fin' => '2016-01-01',
        ])->assertForbidden();
    }
}
