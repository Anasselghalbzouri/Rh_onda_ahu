<?php

namespace Tests\Feature;

use App\Models\Employe;
use App\Models\HistoriqueProfessionnel;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HistoriqueCarriereTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware();
        Carbon::setTestNow('2026-10-27');
    }

    private function employe(array $attrs = []): Employe
    {
        return Employe::forceCreate($attrs + [
            'matricule' => (string) random_int(100000, 999999),
            'nom' => 'TEST',
            'prenom' => 'Agent',
            'fonction' => 'Contrôleur',
            'entite' => 'Navigation Aérienne',
            'categorie' => 'Cadre',
            'echelle' => '10',
            'statut' => 'actif',
        ]);
    }

    private function periodes(Employe $e): array
    {
        return HistoriqueProfessionnel::where('employe_id', $e->id)->orderBy('id')->get()
            ->map(fn ($p) => [$p->poste, $p->date_debut?->toDateString(), $p->date_fin?->toDateString()])
            ->all();
    }

    public function test_fiche_employe_opens_on_fresh_database(): void
    {
        $e = $this->employe();

        $this->getJson("/api/employes/{$e->id}")
            ->assertOk()
            ->assertJsonStructure(['historique_professionnel', 'dossier_personnel']);
    }

    public function test_creation_ouvre_une_periode_pour_un_actif_seulement(): void
    {
        $actif = $this->employe(['date_embauche' => '2010-01-01', 'date_affectation' => '2015-03-01']);
        $retraite = $this->employe(['statut' => 'retraite']);

        $this->assertSame([['Contrôleur', '2015-03-01', null]], $this->periodes($actif));
        $p = HistoriqueProfessionnel::where('employe_id', $actif->id)->first();
        $this->assertSame(['Navigation Aérienne', 'Cadre', '10'], [$p->service, $p->categorie, $p->echelle]);
        $this->assertSame([], $this->periodes($retraite));
    }

    public function test_changement_de_carriere_clot_et_ouvre_une_seule_periode(): void
    {
        $e = $this->employe(['date_embauche' => '2010-01-01']);

        $this->putJson("/api/employes/{$e->id}", ['fonction' => 'Chef de service', 'categorie' => 'Cadre Supérieur'])->assertOk();

        $this->assertSame([
            ['Contrôleur', '2010-01-01', '2026-10-27'],
            ['Chef de service', '2026-10-27', null],
        ], $this->periodes($e));
    }

    public function test_champ_non_suivi_ne_cree_pas_de_periode(): void
    {
        $e = $this->employe();

        $this->putJson("/api/employes/{$e->id}", ['observation' => 'RAS', 'echelon' => '3'])->assertOk();

        $this->assertCount(1, $this->periodes($e));
    }

    public function test_bulk_sync_identique_est_idempotent_et_garde_les_corrections(): void
    {
        $ligne = ['matricule' => '000555', 'nom' => 'SYNC', 'prenom' => 'Agent', 'fonction' => 'Contrôleur', 'entite' => 'Technique'];
        $this->postJson('/api/employes/bulk-sync', ['employes' => [$ligne]])->assertOk();
        $e = Employe::where('matricule', '000555')->firstOrFail();

        // Correction manuelle d'une période passée (FR-012).
        HistoriqueProfessionnel::forceCreate(['employe_id' => $e->id, 'poste' => 'Stagiaire', 'date_debut' => '2005-01-01', 'date_fin' => '2006-01-01']);
        $avant = $this->periodes($e);

        $this->postJson('/api/employes/bulk-sync', ['employes' => [$ligne]])->assertOk();

        $this->assertSame($avant, $this->periodes($e));
        $this->assertCount(2, $avant);
    }

    public function test_depart_en_retraite_clot_sans_rouvrir_meme_avec_changement_de_fonction(): void
    {
        $e = $this->employe(['date_embauche' => '2000-01-01']);

        $e->update(['statut' => 'retraite', 'date_retraite' => '2026-06-30', 'fonction' => 'Autre']);

        $this->assertSame([['Contrôleur', '2000-01-01', '2026-06-30']], $this->periodes($e));
        $this->assertSame(0, HistoriqueProfessionnel::where('employe_id', $e->id)->whereNull('date_fin')->count());
    }

    public function test_migration_cree_une_periode_initiale_par_employe_actif(): void
    {
        [$avecAffectation, $sansAffectation, $retraite] = Employe::withoutEvents(fn () => [
            $this->employe(['date_embauche' => '2010-01-01', 'date_affectation' => '2018-05-01']),
            $this->employe(['date_embauche' => '2012-02-01']),
            $this->employe(['statut' => 'retraite']),
        ]);

        $migration = require database_path('migrations/2026_10_27_000001_create_historique_and_dossier_personnel.php');
        $migration->up();
        $migration->up();

        $this->assertSame([['Contrôleur', '2018-05-01', null]], $this->periodes($avecAffectation));
        $this->assertSame([['Contrôleur', '2012-02-01', null]], $this->periodes($sansAffectation));
        $this->assertSame([], $this->periodes($retraite));
    }
}
