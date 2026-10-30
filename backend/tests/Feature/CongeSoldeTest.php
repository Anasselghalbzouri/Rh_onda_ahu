<?php

namespace Tests\Feature;

use App\Models\DemandeConge;
use App\Models\Employe;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CongeSoldeTest extends TestCase
{
    use RefreshDatabase;

    private function employe(float $solde): Employe
    {
        return Employe::forceCreate([
            'matricule' => '000777',
            'nom' => 'DOE',
            'prenom' => 'Jane',
            'solde_conge' => $solde,
        ]);
    }

    public function test_store_counts_inclusive_days_and_debits_solde(): void
    {
        $this->withoutMiddleware();
        $employe = $this->employe(20);

        $this->postJson('/api/conges', [
            'employe_id' => $employe->id,
            'type_conge' => 'annuel',
            'date_debut' => '2026-07-01',
            'date_fin' => '2026-07-05',
        ])->assertCreated()
            ->assertJsonPath('nombre_jours', 5)
            ->assertJsonPath('statut', 'approuve');

        $this->assertEquals(15, $employe->fresh()->solde_conge);
    }

    public function test_store_uses_manual_nombre_jours_over_dates(): void
    {
        $this->withoutMiddleware();
        $employe = $this->employe(20);

        $this->postJson('/api/conges', [
            'employe_id' => $employe->id,
            'type_conge' => 'annuel',
            'date_debut' => '2026-07-01',
            'date_fin' => '2026-07-05',
            'nombre_jours' => 3,
        ])->assertCreated();

        $this->assertEquals(17, $employe->fresh()->solde_conge);
    }

    public function test_update_applies_only_the_difference(): void
    {
        $this->withoutMiddleware();
        $employe = $this->employe(20);
        $id = $this->postJson('/api/conges', [
            'employe_id' => $employe->id,
            'type_conge' => 'annuel',
            'date_debut' => '2026-07-01',
            'date_fin' => '2026-07-05',
        ])->json('id');

        $this->putJson("/api/conges/{$id}", ['date_fin' => '2026-07-07'])->assertOk();
        $this->assertEquals(13, $employe->fresh()->solde_conge);

        $this->putJson("/api/conges/{$id}", ['nombre_jours' => 2])->assertOk();
        $this->assertEquals(18, $employe->fresh()->solde_conge);
    }

    public function test_update_without_date_change_keeps_solde(): void
    {
        $this->withoutMiddleware();
        $employe = $this->employe(20);
        $id = $this->postJson('/api/conges', [
            'employe_id' => $employe->id,
            'type_conge' => 'annuel',
            'date_debut' => '2026-07-01',
            'date_fin' => '2026-07-05',
        ])->json('id');

        $this->putJson("/api/conges/{$id}", ['motif' => 'Vacances'])->assertOk();

        $this->assertEquals(15, $employe->fresh()->solde_conge);
    }

    public function test_destroy_recredits_solde(): void
    {
        $this->withoutMiddleware();
        $employe = $this->employe(20);
        $id = $this->postJson('/api/conges', [
            'employe_id' => $employe->id,
            'type_conge' => 'annuel',
            'date_debut' => '2026-07-01',
            'date_fin' => '2026-07-05',
        ])->json('id');

        $this->deleteJson("/api/conges/{$id}")->assertOk();

        $this->assertEquals(20, $employe->fresh()->solde_conge);
        $this->assertNull(DemandeConge::find($id));
    }

    public function test_store_rejects_fin_before_debut(): void
    {
        $this->withoutMiddleware();
        $employe = $this->employe(20);

        $this->postJson('/api/conges', [
            'employe_id' => $employe->id,
            'type_conge' => 'annuel',
            'date_debut' => '2026-07-05',
            'date_fin' => '2026-07-01',
        ])->assertStatus(422)->assertJsonValidationErrors('date_fin');

        $this->assertEquals(20, $employe->fresh()->solde_conge);
    }

    public function test_store_refuses_when_solde_insufficient(): void
    {
        $this->withoutMiddleware();
        $employe = $this->employe(3);

        $this->postJson('/api/conges', [
            'employe_id' => $employe->id,
            'type_conge' => 'annuel',
            'date_debut' => '2026-07-01',
            'date_fin' => '2026-07-05',
        ])->assertStatus(422)->assertJsonValidationErrors('nombre_jours');

        $this->assertEquals(3, $employe->fresh()->solde_conge);
        $this->assertSame(0, DemandeConge::count());
    }

    public function test_update_refuses_extension_beyond_solde(): void
    {
        $this->withoutMiddleware();
        $employe = $this->employe(6);
        $id = $this->postJson('/api/conges', [
            'employe_id' => $employe->id,
            'type_conge' => 'annuel',
            'date_debut' => '2026-07-01',
            'date_fin' => '2026-07-05',
        ])->json('id');

        // 1 jour restant : passer de 5 à 7 jours doit être refusé, le solde reste intact
        $this->putJson("/api/conges/{$id}", ['date_fin' => '2026-07-07'])
            ->assertStatus(422)->assertJsonValidationErrors('nombre_jours');
        $this->assertEquals(1, $employe->fresh()->solde_conge);

        $this->deleteJson("/api/conges/{$id}")->assertOk();
        $this->assertEquals(6, $employe->fresh()->solde_conge);
    }

    public function test_conges_require_authentication(): void
    {
        $this->getJson('/api/conges')->assertUnauthorized();
    }
}
