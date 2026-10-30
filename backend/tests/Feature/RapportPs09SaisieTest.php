<?php

namespace Tests\Feature;

use App\Models\RapportPs09;
use App\Models\ResponsableRh;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class RapportPs09SaisieTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->actingAs(ResponsableRh::forceCreate(['login' => 'rh', 'password' => bcrypt('x')]), 'rh');
    }

    private function trimestre(array $surcharge = []): array
    {
        return array_replace_recursive([
            'commentaires' => ['if' => 'RAS'],
            'reclamations' => ['recues' => 4, 'satisfaites' => 3],
            'accidents_travail' => 2,
            'engagements' => [['prevu' => 4, 'realise' => 4], ['prevu' => 0, 'realise' => 1], ['prevu' => null, 'realise' => null]],
            'plan_action' => ['actions' => 2, 'echues' => 1, 'cloturees' => 1, 'recommandation' => 'Suivre'],
        ], $surcharge);
    }

    public function test_get_saisie_annee_vide(): void
    {
        $this->getJson('/api/rapport-activite/saisie?annee=2026')
            ->assertOk()
            ->assertJson(['annee' => 2026, 'trimestres' => ['1' => null, '2' => null, '3' => null, '4' => null], 'annuel' => null]);
    }

    public function test_get_saisie_renvoie_les_donnees_enregistrees(): void
    {
        RapportPs09::create(['annee' => 2026, 'trimestre' => 3, 'donnees' => ['accidents_travail' => 2]]);
        RapportPs09::create(['annee' => 2026, 'trimestre' => 0, 'donnees' => ['stages' => ['besoins' => 3]]]);
        RapportPs09::create(['annee' => 2025, 'trimestre' => 3, 'donnees' => ['accidents_travail' => 9]]);

        $r = $this->getJson('/api/rapport-activite/saisie?annee=2026')->assertOk();

        $r->assertJsonPath('trimestres.3.accidents_travail', 2)
            ->assertJsonPath('trimestres.1', null)
            ->assertJsonPath('annuel.stages.besoins', 3);
        $this->assertNotNull($r->json('modifie_le.3'));
        $this->assertNotNull($r->json('modifie_le.annuel'));
    }

    public function test_put_enregistre_trimestre_et_annuel_partage(): void
    {
        $annuel = ['stages' => ['besoins' => 5, 'stagiaires' => 3, 'actions_amelioration' => 1], 'polyvalence' => ['competences' => 6, 'taches' => 10]];

        $this->putJson('/api/rapport-activite/saisie/2026/3', ['trimestre' => $this->trimestre(), 'annuel' => $annuel])
            ->assertOk()
            ->assertJsonPath('trimestres.3.accidents_travail', 2)
            ->assertJsonPath('trimestres.3.commentaires.if', 'RAS');

        $this->assertSame(2, RapportPs09::count());
        // L'annuel saisi depuis T3 est le même pour T1 (même année).
        $this->getJson('/api/rapport-activite/saisie?annee=2026')->assertJsonPath('annuel', $annuel);
    }

    public function test_cle_absente_non_modifiee(): void
    {
        $this->putJson('/api/rapport-activite/saisie/2026/3', ['trimestre' => $this->trimestre(), 'annuel' => ['stages' => ['besoins' => 5]]])->assertOk();
        $this->putJson('/api/rapport-activite/saisie/2026/3', ['trimestre' => $this->trimestre(['accidents_travail' => 7])])->assertOk();

        $this->getJson('/api/rapport-activite/saisie?annee=2026')
            ->assertJsonPath('trimestres.3.accidents_travail', 7)
            ->assertJsonPath('annuel.stages.besoins', 5);
    }

    public function test_cles_inconnues_ignorees(): void
    {
        $this->putJson('/api/rapport-activite/saisie/2026/3', ['trimestre' => $this->trimestre(['pirate' => 'x'])])->assertOk();

        $this->assertArrayNotHasKey('pirate', RapportPs09::where('trimestre', 3)->first()->donnees);
    }

    #[DataProvider('valeursInvalides')]
    public function test_valeurs_invalides_refusees(array $surcharge, string $champ): void
    {
        $this->putJson('/api/rapport-activite/saisie/2026/3', ['trimestre' => $this->trimestre($surcharge)])
            ->assertStatus(422)
            ->assertJsonValidationErrors($champ);
        $this->assertSame(0, RapportPs09::count());
    }

    public static function valeursInvalides(): array
    {
        return [
            'négatif' => [['accidents_travail' => -1], 'trimestre.accidents_travail'],
            'non entier' => [['reclamations' => ['recues' => 2.5]], 'trimestre.reclamations.recues'],
            'commentaire trop long' => [['commentaires' => ['ia' => str_repeat('a', 2001)]], 'trimestre.commentaires.ia'],
            'satisfaites > reçues' => [['reclamations' => ['recues' => 2, 'satisfaites' => 3]], 'trimestre.reclamations.satisfaites'],
            'échues > actions' => [['plan_action' => ['echues' => 3]], 'trimestre.plan_action.echues'],
            'clôturées > actions' => [['plan_action' => ['cloturees' => 3]], 'trimestre.plan_action.cloturees'],
        ];
    }

    public function test_message_reclamations_en_francais(): void
    {
        $errors = $this->putJson('/api/rapport-activite/saisie/2026/3', ['trimestre' => $this->trimestre(['reclamations' => ['recues' => 2, 'satisfaites' => 3]])])->json('errors');
        $this->assertSame('Les réclamations satisfaites ne peuvent pas dépasser les réclamations reçues.', $errors['trimestre.reclamations.satisfaites'][0]);
    }

    public function test_engagements_doivent_avoir_trois_mois(): void
    {
        $body = $this->trimestre();
        $body['engagements'] = [['prevu' => 1, 'realise' => 1]];

        $this->putJson('/api/rapport-activite/saisie/2026/3', ['trimestre' => $body])
            ->assertStatus(422)->assertJsonValidationErrors('trimestre.engagements');
    }

    public function test_realise_sans_prevu_accepte(): void
    {
        $this->putJson('/api/rapport-activite/saisie/2026/3', ['trimestre' => ['engagements' => [['prevu' => 0, 'realise' => 2], ['prevu' => 0, 'realise' => 0], ['prevu' => 0, 'realise' => 0]]]])
            ->assertOk();
    }

    public function test_trimestre_inconnu_refuse(): void
    {
        $this->putJson('/api/rapport-activite/saisie/2026/5', ['trimestre' => $this->trimestre()])->assertClientError();
        $this->putJson('/api/rapport-activite/saisie/2026/0', ['trimestre' => $this->trimestre()])->assertClientError();
        $this->assertSame(0, RapportPs09::count());
    }

    public function test_dg_ne_peut_pas_enregistrer(): void
    {
        $dg = ResponsableRh::forceCreate(['login' => 'dg', 'password' => bcrypt('x')]);
        $dg->setAttribute('role', 'dg');
        $this->actingAs($dg, 'rh');

        $this->putJson('/api/rapport-activite/saisie/2026/3', ['trimestre' => $this->trimestre()])->assertForbidden();
        $this->getJson('/api/rapport-activite/saisie?annee=2026')->assertOk();
        $this->assertSame(0, RapportPs09::count());
    }
}
