<?php

namespace Tests\Feature;

use App\Models\Employe;
use App\Models\Reclamation;
use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Tests\TestCase;

class DemoSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_refuses_any_database_other_than_demo(): void
    {
        $employe = Employe::forceCreate(['matricule' => '000777', 'nom' => 'REEL', 'prenom' => 'Garde']);

        try {
            (new DemoSeeder)->run();
            $this->fail('Le générateur aurait dû refuser cette base.');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString('demo.sqlite', $e->getMessage());
        }

        $this->assertDatabaseHas('employe', ['id' => $employe->id, 'nom' => 'REEL']);
    }

    public function test_fills_every_section_with_consistent_data(): void
    {
        Storage::fake('local');

        (new DemoSeeder)->remplir();

        foreach (['service', 'employe', 'historique_professionnel', 'demande_conge', 'cours', 'plan_formation', 'formation', 'employe_formation', 'evaluation_formation', 'pieces_jointes', 'dossier_personnel', 'reclamation', 'reclamation_compteur', 'rapport_ps09', 'notification'] as $table) {
            $this->assertGreaterThan(0, DB::table($table)->count(), "Table vide : {$table}");
        }

        $this->assertSame(Employe::count(), Employe::distinct()->count('matricule'));
        $this->assertSame(Reclamation::count(), Reclamation::distinct()->count('numero'));
        $this->assertSame(5, Employe::whereIn('statut', ['actif', 'mute', 'retraite', 'parti', 'suspendu'])->distinct()->count('statut'));

        foreach (Reclamation::all() as $r) {
            $this->assertStringEndsWith('/'.$r->date_reception->year, $r->numero);
            $this->assertLessThanOrEqual(now()->toDateString(), $r->date_reception->toDateString());

            if ($r->date_reponse_1) {
                $this->assertGreaterThanOrEqual($r->date_reception->toDateString(), $r->date_reponse_1->toDateString());
                $this->assertNotNull($r->contenu_reponse_1);
            }
            if ($r->date_reponse_2) {
                $this->assertGreaterThanOrEqual($r->date_reponse_1->toDateString(), $r->date_reponse_2->toDateString());
            }
            $this->assertSame(in_array($r->etat, ['resolue', 'rejetee'], true), $r->date_solution !== null);
        }

        // Les numéros suivants ne doivent pas entrer en collision avec le registre fictif.
        foreach (DB::table('reclamation_compteur')->get() as $compteur) {
            $this->assertSame(Reclamation::where('numero', 'like', "%/{$compteur->annee}")->count(), (int) $compteur->dernier);
        }

        // Les téléchargements de documents doivent trouver leur fichier.
        foreach (DB::table('pieces_jointes')->pluck('chemin') as $chemin) {
            Storage::disk('local')->assertExists($chemin);
            $this->assertStringContainsString('DOCUMENT FICTIF DE TEST', Storage::disk('local')->get($chemin));
        }
    }
}
