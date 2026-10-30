<?php

namespace Tests\Feature;

use App\Models\Employe;
use App\Models\Reclamation;
use App\Models\ResponsableRh;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PhpOffice\PhpSpreadsheet\Cell\DataType;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as XlsDate;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ReclamationTest extends TestCase
{
    use RefreshDatabase;

    private Employe $employe;

    private string $annee;

    protected function setUp(): void
    {
        parent::setUp();

        $this->annee = now()->format('Y');
        $this->employe = Employe::forceCreate(['matricule' => '000777', 'nom' => 'ALAMI', 'prenom' => 'Sara']);
    }

    private function connecter(?string $role = null): void
    {
        $compte = ResponsableRh::forceCreate(['login' => $role ?? 'rh', 'password' => bcrypt('x')]);
        if ($role) {
            $compte->setAttribute('role', $role);
        }
        $this->actingAs($compte, 'rh');
    }

    private function creation(array $champs = []): array
    {
        return $champs + [
            'employe_id' => $this->employe->id,
            'date_reception' => now()->subDays(10)->toDateString(),
            'type' => 'Prime de formation',
            'description' => 'Solde de congé erroné',
            'canal' => 'Fiche de réclamation',
        ];
    }

    private function creer(array $champs = []): Reclamation
    {
        return Reclamation::findOrFail($this->postJson('/api/reclamations', $this->creation($champs))->assertCreated()->json('id'));
    }

    private function suivi(Reclamation $r, array $champs = []): array
    {
        return $champs + [
            'date_reception' => $r->date_reception->toDateString(),
            'type' => $r->type,
            'description' => $r->description,
            'canal' => $r->canal,
            'etat' => $r->etat,
        ];
    }

    private function jour(int $avant): string
    {
        return now()->subDays($avant)->toDateString();
    }

    public function test_list_access_by_role(): void
    {
        $this->getJson('/api/reclamations')->assertUnauthorized();

        $this->connecter('employe');
        $this->getJson('/api/reclamations')->assertForbidden();

        $this->connecter('dg');
        $this->getJson('/api/reclamations')->assertOk();

        $this->connecter();
        $this->getJson('/api/reclamations')->assertOk();
    }

    public function test_list_returns_options_and_sorts_most_recent_first(): void
    {
        $this->connecter();
        $ancienne = $this->creer(['date_reception' => $this->jour(5)]);
        $recente = $this->creer(['date_reception' => $this->jour(1)]);
        $memeJour = $this->creer(['date_reception' => $this->jour(1)]);

        $this->getJson('/api/reclamations')
            ->assertOk()
            ->assertJsonPath('total', 3)
            ->assertJsonPath('data.0.id', $memeJour->id)
            ->assertJsonPath('data.1.id', $recente->id)
            ->assertJsonPath('data.2.id', $ancienne->id)
            ->assertJsonPath('options.etats.2', ['key' => 'resolue', 'label' => 'Résolue']);
    }

    public function test_store_generates_number_and_copies_employee(): void
    {
        $this->connecter();

        $this->postJson('/api/reclamations', $this->creation(['etat' => 'resolue', 'numero' => '999/2000']))
            ->assertCreated()
            ->assertJsonPath('numero', "001/{$this->annee}")
            ->assertJsonPath('matricule', '000777')
            ->assertJsonPath('nom_complet', 'ALAMI Sara')
            ->assertJsonPath('type', 'Prime de formation')
            ->assertJsonPath('canal', 'Fiche de réclamation')
            ->assertJsonPath('etat', 'nouvelle');

        $this->assertSame("002/{$this->annee}", $this->creer()->numero);
    }

    public function test_numbering_restarts_each_year_and_never_reuses_a_deleted_number(): void
    {
        $this->connecter();
        $this->creer();
        $precedente = now()->subYear();
        $this->assertSame('001/'.$precedente->format('Y'), $this->creer(['date_reception' => $precedente->toDateString()])->numero);

        $this->deleteJson('/api/reclamations/'.$this->creer()->id)->assertOk();

        $this->assertSame("003/{$this->annee}", $this->creer()->numero);
    }

    public function test_store_rejects_invalid_data_in_french(): void
    {
        $this->connecter();

        $this->postJson('/api/reclamations', [])->assertJsonValidationErrors([
            'employe_id' => 'Choisissez un employé.',
            'date_reception' => 'La date de réception est obligatoire.',
            'type' => 'Le type de réclamation est obligatoire.',
            'description' => 'La description est obligatoire.',
            'canal' => 'Le canal est obligatoire.',
        ]);

        $this->postJson('/api/reclamations', $this->creation(['type' => str_repeat('x', 256), 'canal' => str_repeat('y', 256), 'employe_id' => 99999]))
            ->assertJsonValidationErrors([
                'type' => 'Le type de réclamation ne peut pas dépasser 255 caractères.',
                'canal' => 'Le canal ne peut pas dépasser 255 caractères.',
                'employe_id' => 'Employé introuvable.',
            ]);

        $this->postJson('/api/reclamations', $this->creation(['date_reception' => now()->addDay()->toDateString()]))
            ->assertJsonValidationErrors(['date_reception' => 'La date ne peut pas être dans le futur.']);

        $this->assertSame(0, Reclamation::count());
    }

    public function test_only_rh_can_write(): void
    {
        $this->connecter();
        $r = $this->creer();

        foreach (['dg', 'employe'] as $role) {
            $this->connecter($role);
            $this->postJson('/api/reclamations', $this->creation())->assertForbidden();
            $this->putJson("/api/reclamations/{$r->id}", $this->suivi($r))->assertForbidden();
            $this->deleteJson("/api/reclamations/{$r->id}")->assertForbidden();
        }

        $this->assertSame(1, Reclamation::count());
    }

    public function test_complaint_survives_employee_removal(): void
    {
        $this->connecter();
        $r = $this->creer();

        $this->employe->delete();

        $this->getJson('/api/reclamations')
            ->assertJsonPath('data.0.id', $r->id)
            ->assertJsonPath('data.0.matricule', '000777')
            ->assertJsonPath('data.0.nom_complet', 'ALAMI Sara');

        $this->putJson("/api/reclamations/{$r->id}", $this->suivi($r, ['etat' => 'en_cours']))
            ->assertOk()
            ->assertJsonPath('matricule', '000777')
            ->assertJsonPath('nom_complet', 'ALAMI Sara');
    }

    public function test_update_saves_follow_up_and_ignores_number(): void
    {
        $this->connecter();
        $r = $this->creer();

        $this->putJson("/api/reclamations/{$r->id}", $this->suivi($r, [
            'numero' => '999/2000',
            'date_reponse_1' => $this->jour(8),
            'contenu_reponse_1' => 'Dossier transmis',
            'date_reponse_2' => $this->jour(5),
            'contenu_reponse_2' => 'Solde corrigé',
            'date_solution' => $this->jour(4),
            'etat' => 'resolue',
            'remarques' => 'RAS',
        ]))
            ->assertOk()
            ->assertJsonPath('numero', "001/{$this->annee}")
            ->assertJsonPath('date_reponse_1', $this->jour(8))
            ->assertJsonPath('contenu_reponse_2', 'Solde corrigé')
            ->assertJsonPath('date_solution', $this->jour(4))
            ->assertJsonPath('etat', 'resolue')
            ->assertJsonPath('remarques', 'RAS');
    }

    #[DataProvider('reglesDeSuivi')]
    public function test_update_enforces_follow_up_rules(array $champs, string $erreur, string $message): void
    {
        $this->connecter();
        $r = $this->creer();

        $champs = array_map(fn ($v) => is_int($v) ? $this->jour($v) : $v, $champs);

        $this->putJson("/api/reclamations/{$r->id}", $this->suivi($r, $champs))
            ->assertJsonValidationErrors([$erreur => $message]);
    }

    public static function reglesDeSuivi(): array
    {
        return [
            '1ère réponse avant réception' => [
                ['date_reponse_1' => 20, 'contenu_reponse_1' => 'x'],
                'date_reponse_1', 'La date de 1ère réponse ne peut pas précéder la date de réception.',
            ],
            '2ème sans 1ère' => [
                ['date_reponse_2' => 5, 'contenu_reponse_2' => 'x'],
                'date_reponse_2', 'La 2ème réponse exige une 1ère réponse.',
            ],
            '2ème avant 1ère' => [
                ['date_reponse_1' => 5, 'contenu_reponse_1' => 'x', 'date_reponse_2' => 8, 'contenu_reponse_2' => 'y'],
                'date_reponse_2', 'La date de 2ème réponse ne peut pas précéder celle de la 1ère réponse.',
            ],
            'date 1 sans contenu' => [
                ['date_reponse_1' => 5],
                'contenu_reponse_1', 'Saisissez la date et le contenu de la réponse.',
            ],
            'contenu 1 sans date' => [
                ['contenu_reponse_1' => 'x'],
                'date_reponse_1', 'Saisissez la date et le contenu de la réponse.',
            ],
            'date 2 sans contenu' => [
                ['date_reponse_1' => 8, 'contenu_reponse_1' => 'x', 'date_reponse_2' => 5],
                'contenu_reponse_2', 'Saisissez la date et le contenu de la réponse.',
            ],
            'contenu 2 sans date' => [
                ['date_reponse_1' => 8, 'contenu_reponse_1' => 'x', 'contenu_reponse_2' => 'y'],
                'date_reponse_2', 'Saisissez la date et le contenu de la réponse.',
            ],
            'résolue sans solution' => [
                ['etat' => 'resolue'],
                'date_solution', 'La date de solution est obligatoire pour une réclamation résolue ou rejetée.',
            ],
            'rejetée sans solution' => [
                ['etat' => 'rejetee'],
                'date_solution', 'La date de solution est obligatoire pour une réclamation résolue ou rejetée.',
            ],
            'solution en cours' => [
                ['etat' => 'en_cours', 'date_solution' => 5],
                'date_solution', "La date de solution n'est permise que pour une réclamation résolue ou rejetée.",
            ],
            'solution avant réception' => [
                ['etat' => 'resolue', 'date_solution' => 20],
                'date_solution', 'La date de solution ne peut pas précéder la date de réception.',
            ],
            'état inconnu' => [
                ['etat' => 'x'],
                'etat', 'État de réclamation inconnu.',
            ],
        ];
    }

    public function test_update_rejects_future_dates(): void
    {
        $this->connecter();
        $r = $this->creer();
        $demain = now()->addDay()->toDateString();

        foreach (['date_reception' => [], 'date_reponse_1' => ['contenu_reponse_1' => 'x'], 'date_solution' => ['etat' => 'resolue']] as $champ => $autres) {
            $this->putJson("/api/reclamations/{$r->id}", $this->suivi($r, [$champ => $demain] + $autres))
                ->assertJsonValidationErrors([$champ => 'La date ne peut pas être dans le futur.']);
        }
    }

    public function test_reception_date_can_change_only_within_number_year(): void
    {
        $this->connecter();
        $r = $this->creer();

        $this->putJson("/api/reclamations/{$r->id}", $this->suivi($r, ['date_reception' => now()->subYear()->toDateString()]))
            ->assertJsonValidationErrors([
                'date_reception' => "L'année de réception doit rester celle du numéro. Supprimez et recréez la réclamation si elle est fausse.",
            ]);

        $this->putJson("/api/reclamations/{$r->id}", $this->suivi($r, ['date_reception' => $this->jour(0)]))
            ->assertOk()
            ->assertJsonPath('date_reception', $this->jour(0));
    }

    public function test_resolved_complaint_can_be_reopened(): void
    {
        $this->connecter();
        $r = $this->creer();
        $this->putJson("/api/reclamations/{$r->id}", $this->suivi($r, ['etat' => 'resolue', 'date_solution' => $this->jour(1)]))->assertOk();

        $this->putJson("/api/reclamations/{$r->id}", $this->suivi($r, ['etat' => 'en_cours', 'date_solution' => null]))
            ->assertOk()
            ->assertJsonPath('etat', 'en_cours')
            ->assertJsonPath('date_solution', null);
    }

    public function test_delete_and_unknown_id(): void
    {
        $this->connecter();
        $r = $this->creer();

        $this->deleteJson("/api/reclamations/{$r->id}")->assertOk()->assertJsonPath('message', 'Réclamation supprimée.');
        $this->assertDatabaseMissing('reclamation', ['id' => $r->id]);

        $this->deleteJson("/api/reclamations/{$r->id}")->assertNotFound();
        $this->putJson("/api/reclamations/{$r->id}", $this->suivi($r))->assertNotFound();
    }

    public function test_search_and_filters(): void
    {
        $this->connecter();
        $autre = Employe::forceCreate(['matricule' => '000888', 'nom' => 'ZIANI', 'prenom' => 'Ali']);
        $a = $this->creer();
        $b = $this->creer(['employe_id' => $autre->id, 'type' => 'Erreur de calcul']);
        $this->putJson("/api/reclamations/{$b->id}", $this->suivi($b, ['etat' => 'en_cours']))->assertOk();

        $ids = fn (string $requete) => array_column($this->getJson('/api/reclamations?'.$requete)->assertOk()->json('data'), 'id');

        $this->assertSame([$a->id], $ids('search='.urlencode($a->numero)));
        $this->assertSame([$b->id], $ids('search=000888'));
        $this->assertSame([$a->id], $ids('search=alam'));
        $this->assertSame([$b->id], $ids('etat=en_cours'));
        $this->assertSame([$a->id], $ids('search=prime'));
        $this->assertSame([$b->id], $ids('search=calcul&etat=en_cours'));
        $this->assertSame([], $ids('search=ziani&etat=nouvelle'));
    }

    /** @return array<string, Worksheet> */
    private function exporter(string $requete = ''): array
    {
        $response = $this->get('/api/reclamations/export'.$requete)->assertOk();
        $this->assertStringContainsString('Tableau_suivi_reclamations_', (string) $response->headers->get('Content-Disposition'));

        $chemin = tempnam(sys_get_temp_dir(), 'reclamations-');
        file_put_contents($chemin, $response->streamedContent());
        $classeur = IOFactory::load($chemin);
        @unlink($chemin);

        $feuilles = [];
        foreach ($classeur->getWorksheetIterator() as $feuille) {
            $feuilles[$feuille->getTitle()] = $feuille;
        }

        return $feuilles;
    }

    public function test_export_access_by_role(): void
    {
        $this->getJson('/api/reclamations/export')->assertUnauthorized();

        $this->connecter('employe');
        $this->getJson('/api/reclamations/export')->assertForbidden();

        $this->connecter('dg');
        $this->get('/api/reclamations/export')->assertOk();
    }

    public function test_export_reproduces_the_workbook_layout(): void
    {
        $this->connecter();
        $this->creer();

        $feuille = $this->exporter()["Réclamation_{$this->annee}"];

        $this->assertCount(1, $feuille->getDrawingCollection());
        $this->assertSame('Date de mise à jour: '.now()->format('d/m/Y'), $feuille->getCell('A7')->getValue());
        $this->assertSame('Tableau de suivi et de traitement des réclamations du personnel', $feuille->getCell('A9')->getValue());
        $this->assertArrayHasKey('A9:O9', $feuille->getMergeCells());
        $this->assertSame([
            'Numéro réclamation', 'Date de réception', 'Mle', 'Nom & Prénom', 'Type de réclamation',
            'Description de la réclamation', 'Canal utilisé par le réclamant', 'Date 1ère réponse',
            'Contenu 1ère réponse apportée', 'Date 2ème réponse', 'Contenu 2ème réponse apportée',
            'Date de solution définitive', 'État de réclamation', 'Autres remarques',
        ], $feuille->rangeToArray('A12:N12')[0]);
        $this->assertSame('808080', $feuille->getStyle('A12')->getFill()->getStartColor()->getRGB());
        $this->assertSame('FFFFFF', $feuille->getStyle('A12')->getFont()->getColor()->getRGB());
    }

    public function test_export_writes_complaint_values(): void
    {
        $this->connecter();
        $r = $this->creer(['date_reception' => $this->jour(10), 'remarques' => '=1+1']);
        $this->putJson("/api/reclamations/{$r->id}", $this->suivi($r, [
            'date_reponse_1' => $this->jour(8),
            'contenu_reponse_1' => 'Dossier transmis',
            'date_solution' => $this->jour(2),
            'etat' => 'resolue',
            'remarques' => '=1+1',
        ]))->assertOk();

        $feuille = $this->exporter()["Réclamation_{$this->annee}"];

        $this->assertSame("001/{$this->annee}", $feuille->getCell('A13')->getValue());
        $this->assertSame('000777', $feuille->getCell('C13')->getValue());
        $this->assertSame('ALAMI Sara', $feuille->getCell('D13')->getValue());
        $this->assertSame('Prime de formation', $feuille->getCell('E13')->getValue());
        $this->assertSame('Fiche de réclamation', $feuille->getCell('G13')->getValue());
        $this->assertSame('Résolue', $feuille->getCell('M13')->getValue());
        $this->assertNull($feuille->getCell('J13')->getValue());

        // Vraies dates Excel, triables et filtrables, affichées en JJ/MM/AAAA.
        $this->assertSame(now()->subDays(10)->format('d/m/Y'), XlsDate::excelToDateTimeObject($feuille->getCell('B13')->getValue())->format('d/m/Y'));
        $this->assertSame('dd/mm/yyyy', $feuille->getStyle('B13')->getNumberFormat()->getFormatCode());

        // Une valeur commençant par « = » ne doit pas devenir une formule dans Excel.
        $this->assertSame('=1+1', $feuille->getCell('N13')->getValue());
        $this->assertSame(DataType::TYPE_STRING, $feuille->getCell('N13')->getDataType());
    }

    public function test_export_sorts_oldest_first_and_groups_quarters(): void
    {
        $this->connecter();
        $annee = (int) $this->annee;
        // Avril puis janvier saisis dans le désordre ; dates fixes dans le passé d'une année complète.
        $this->creer(['date_reception' => ($annee - 1).'-04-10']);
        $this->creer(['date_reception' => ($annee - 1).'-01-20']);
        $this->creer(['date_reception' => ($annee - 1).'-02-05']);

        $feuille = $this->exporter()['Réclamation_'.($annee - 1)];

        $this->assertSame(['002/'.($annee - 1), '003/'.($annee - 1), '001/'.($annee - 1)], [
            $feuille->getCell('A13')->getValue(),
            $feuille->getCell('A14')->getValue(),
            $feuille->getCell('A15')->getValue(),
        ]);
        $this->assertSame('1er Trimestre', $feuille->getCell('O13')->getValue());
        $this->assertArrayHasKey('O13:O14', $feuille->getMergeCells());
        $this->assertSame('FFD966', $feuille->getStyle('O13')->getFill()->getStartColor()->getRGB());
        $this->assertSame(90, $feuille->getStyle('O13')->getAlignment()->getTextRotation());
        $this->assertSame('2ème Trimestre', $feuille->getCell('O15')->getValue());
        $this->assertSame('92D050', $feuille->getStyle('O15')->getFill()->getStartColor()->getRGB());
    }

    public function test_export_has_one_sheet_per_year_and_applies_filters(): void
    {
        $this->connecter();
        $autre = Employe::forceCreate(['matricule' => '000888', 'nom' => 'ZIANI', 'prenom' => 'Ali']);
        $precedente = (int) $this->annee - 1;
        $this->creer();
        $ancienne = $this->creer(['date_reception' => "{$precedente}-05-10", 'employe_id' => $autre->id]);
        $this->putJson("/api/reclamations/{$ancienne->id}", $this->suivi($ancienne, ['etat' => 'en_cours']))->assertOk();

        $this->assertSame(["Réclamation_{$precedente}", "Réclamation_{$this->annee}"], array_keys($this->exporter()));

        $this->assertSame(["Réclamation_{$precedente}"], array_keys($this->exporter('?search=ziani')));
        $this->assertSame(["Réclamation_{$precedente}"], array_keys($this->exporter('?etat=en_cours')));
    }

    public function test_export_without_complaint_keeps_the_empty_layout(): void
    {
        $this->connecter();

        $feuille = $this->exporter()["Réclamation_{$this->annee}"];

        $this->assertSame('Numéro réclamation', $feuille->getCell('A12')->getValue());
        $this->assertNull($feuille->getCell('A13')->getValue());
    }

    public function test_list_page_size_is_capped(): void
    {
        $this->connecter();
        $this->creer();

        $this->getJson('/api/reclamations?per_page=500')->assertJsonPath('per_page', 200);
        $this->getJson('/api/reclamations')->assertJsonPath('per_page', 15);
    }
}
