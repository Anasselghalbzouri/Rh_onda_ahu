<?php

namespace Tests\Feature;

use App\Models\Employe;
use App\Models\Formation;
use App\Models\RapportPs09;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\RichText\RichText;
use PhpOffice\PhpSpreadsheet\Shared\Date as XlsDate;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Tests\TestCase;

/**
 * Classeur de test construit à la volée (le vrai modèle contient des données
 * réelles et n'est pas versionné). Même organisation que la feuille
 * « E3 Rap Act Oct 2025 » (année de référence 2025), lignes décalées, libellés
 * de trimestre hétérogènes et titres de section collés sous certains tableaux.
 * Valeur du fichier : 9 partout, sauf formations planifiées « 3 Ttre 25 » = 7.
 */
class RapportPs09ExportTest extends TestCase
{
    use RefreshDatabase;

    private const GABARIT = 'E3 Rap Act Oct 2025';

    private string $modele;

    /** @var array<string,int> ligne « Commentaire(s) » par section */
    private array $commentaires = [];

    /** Lignes de la liste I.B. */
    private array $listeRecrutements = [];

    private int $plan;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware();
        $this->modele = storage_path('framework/testing/ps09-test.xlsx');
        @mkdir(dirname($this->modele), 0777, true);
        $this->construireModele();
        config(['rapport.ps09_template_path' => $this->modele]);
    }

    protected function tearDown(): void
    {
        @unlink($this->modele);
        parent::tearDown();
    }

    private function construireModele(): void
    {
        $wb = new Spreadsheet();
        $wb->getActiveSheet()->setTitle('E3 Rap Act Sep 2025')->setCellValue('A1', 'témoin feuille 2025');
        $ws = $wb->createSheet()->setTitle(self::GABARIT);
        $ws->setCellValue('F5', (int) XlsDate::formattedPHPToExcel(2025, 10, 31));

        $sections = ['I.A - Evaluation', 'I.B - Recrutement', 'I.C- Evaluation à Froid', 'I.D - Réclamations', 'I.E - Formation', 'I.F- Accidents de Travail', 'I.G - Engagements', 'IV.a - Intégration', 'IV.b - Départs', 'IV.c - Stages', 'IV.d - Polyvalence du Personnel'];
        $r = 11;
        foreach ($sections as $i => $titre) {
            $ws->setCellValue("B$r", $titre);
            if ($i === 1) {
                // Texte de section contenant des mots-ancres des tableaux (piège).
                $ws->setCellValue('B'.($r + 1), 'Accueil de 3 Stagiaires ; Taux de polyvalence ; SUIVI Engagements');
                foreach ([2, 3, 4] as $k) {
                    $ws->setCellValue('B'.($r + $k), "$k. Recrutement en Mars 2020 pour le poste de Modèle");
                    $this->listeRecrutements[] = $r + $k;
                }
                $r += 3;
            }
            $ws->setCellValue('I'.($r + 2), 'Commentaire(s)');
            $ws->setCellValue('I'.($r + 4), 'ancien commentaire');
            $ws->mergeCells('I'.($r + 4).':M'.($r + 8));
            $this->commentaires[$titre] = $r + 2;
            if ($i === 6) { // plan d'action après I.G
                $r += 11;
                $this->plan = $r + 2;
                $ws->setCellValue("B$r", "II - Etat d'avancement du Plan d'action(s) :");
                $ws->setCellValue('B'.($r + 2), "Nbre d'action :")->setCellValue('E'.($r + 2), 9)->setCellValue('I'.($r + 2), 'ancienne reco');
                $ws->setCellValue('B'.($r + 3), "Nbre d'action Echues :")->setCellValue('E'.($r + 3), 9)->setCellValue('G'.($r + 3), '=E'.($r + 4).'/E'.($r + 3));
                $ws->setCellValue('B'.($r + 4), "Nbre d'action Clôturées :")->setCellValue('E'.($r + 4), 9);
            }
            $r += 11;
        }

        // Formation 200-206 (3T24 … 4T25) + AT.
        foreach (['B' => 'Formations non exprimées', 'C' => 'Trimestre', 'F' => 'Nbre de Formation Planifiées', 'G' => 'Nbre de Formations Réalisées', 'H' => 'Tx de Réalisation', 'J' => 'Nbre des Formations Evaluées', 'M' => 'Nb des formations efficaces', 'Q' => "Nbre \nAT"] as $c => $v) {
            $ws->setCellValue("{$c}200", $v);
        }
        foreach (['3 Ttre 24', '4Ttre 24', '1° Tre 25', '2 Ttre 25', '3 Ttre 25', '4 Ttre 25'] as $k => $lib) {
            $l = 201 + $k;
            $ws->setCellValue("C$l", $lib)->setCellValue("F$l", $lib === '3 Ttre 25' ? 7 : 9)->setCellValue("G$l", 9)->setCellValue("J$l", 9)->setCellValue("M$l", 9)->setCellValue("Q$l", 9)->setCellValue("H$l", "=G$l/F$l");
        }
        $ws->setCellValue('B208', 'Nomb Totale des formations réalisées 2025')->setCellValue('I208', '=SUM(G203:G206)');

        // Recrutement & intégration 210-217 (2020 … 2026).
        $ws->setCellValue('B210', 'Année')->setCellValue('D210', 'les Besoins en recrutement exprimés')->setCellValue('E210', 'Nbre des recrutements Satisfaits')
            ->setCellValue('I210', "Nbre d'effectif intégré")->setCellValue('K210', 'Nbre de départs')->setCellValue('M210', 'Nbre de mutation');
        foreach (range(2020, 2026) as $k => $annee) {
            $l = 211 + $k;
            $ws->setCellValue("B$l", $annee)->setCellValue("F$l", "=E$l/D$l");
            if ($annee < 2026) {
                foreach (['D', 'E', 'I', 'K', 'M'] as $c) {
                    $ws->setCellValue("$c$l", 9);
                }
            }
        }

        $ws->setCellValue('C220', 'Contrôleurs ')->setCellValue('D220', 'Pompiers')->setCellValue('B222', 'Exigence ')->setCellValue('B223', 'Nbre')->setCellValue('E222', '=C222+D222');

        // Réclamations 225-231 (3T24 … 4T25).
        $ws->setCellValue('B225', 'Trimestre')->setCellValue('C225', 'Nbre des réclamations reçus')->setCellValue('D225', 'Nbre des réclamations satisfaits');
        foreach (['3 Ttre 24', '4Ttre 24', '1Ttre 25', '2 Ttre 25', '3 Ttre 25', '4 Ttre 25'] as $k => $lib) {
            $l = 226 + $k;
            $ws->setCellValue("B$l", $lib)->setCellValue("C$l", 9)->setCellValue("D$l", 9)->setCellValue("E$l", 9)->setCellValue("F$l", "=D$l/C$l");
        }
        $ws->setCellValue('H230', 'Encours de traitement'); // note de « 3 Ttre 25 »

        // Engagements siège : en-tête sur 2 lignes (237-238), 12 mois 2025 (239-250), taux trimestriels (252-256).
        $ws->setCellValue('B235', '1 - SUIVI Engagements SIEGE :')->setCellValue('B237', 'Mois')->setCellValue('C238', 'Prévu');
        foreach (range(1, 12) as $m) {
            $l = 238 + $m;
            $ws->setCellValue("B$l", (int) XlsDate::formattedPHPToExcel(2025, $m, 1))->setCellValue("C$l", 9)->setCellValue("D$l", 9)->setCellValue("G$l", "=D$l/C$l");
        }
        $ws->setCellValue('F252', 'Trimestre')->setCellValue('G252', 'Taux Trimestriel');
        foreach (range(1, 4) as $t) {
            $ws->setCellValue('F'.(252 + $t), "{$t}° Tre 25")->setCellValue('G'.(252 + $t), '=G241');
        }

        // Stagiaires 262-269 (2019 … 2025), titre collé dessous.
        $ws->setCellValue('B260', '1 - Stagiaires :')->setCellValue('B262', 'Année');
        foreach (range(2019, 2025) as $k => $annee) {
            $ws->setCellValue('B'.(263 + $k), $annee)->setCellValue('C'.(263 + $k), 9)->setCellValue('D'.(263 + $k), 9)->setCellValue('E'.(263 + $k), 9);
        }
        $ws->setCellValue('B270', '1 - Suivi le risque de contamination au covid');

        // Polyvalence 277-283 (2020 … 2025), titre collé dessous, puis satisfaction en recrutement.
        $ws->setCellValue('B275', ' 1 - Gestion des Connaissances/Polyvalence')->setCellValue('D277', 'Taux de polyvalence');
        foreach (range(2020, 2025) as $k => $annee) {
            $l = 278 + $k;
            $ws->setCellValue("B$l", $annee)->setCellValue("D$l", "=E$l/F$l")->setCellValue("E$l", 9)->setCellValue("F$l", 9);
        }
        $ws->setCellValue('B284', '1 - Taux de Satisfaction en Recrutement :');
        $ws->setCellValue('B287', 'Satisfaction en Recrutement  2023')->setCellValue('H287', '=E214/D214');
        $ws->setCellValue('B288', 'Satisfaction en Recrutement  2024')->setCellValue('H288', '=E215/D215');

        // Covid 292-298 (3T23 … 4T24).
        $ws->setCellValue('B292', 'Trimestre')->setCellValue('G292', 'Taux de contamination au covid');
        foreach (['3 Ttre 23', '4 Ttre 23', '1 Ttre 24', '2 Ttre 24', '3 Ttre 24', '4 Ttre 24'] as $k => $lib) {
            $ws->setCellValue('B'.(293 + $k), $lib)->setCellValue('D'.(293 + $k), 9)->setCellValue('E'.(293 + $k), 9);
        }

        $ws->getPageSetup()->setPrintArea('A1:N300');
        (new Xlsx($wb))->save($this->modele);

        // Graphique minimal référant la feuille gabarit (renommage, research R5).
        $zip = new \ZipArchive();
        $zip->open($this->modele);
        $zip->addFromString('xl/charts/chart1.xml', "<c:chartSpace><c:f>'".self::GABARIT."'!\$C\$201:\$C\$206</c:f></c:chartSpace>");
        $zip->close();
    }

    private function saisir(int $annee = 2026): void
    {
        RapportPs09::create(['annee' => $annee, 'trimestre' => 3, 'donnees' => [
            'commentaires' => ['ia' => 'Bonne efficacité', 'if' => 'R&D <test>', 'ivd' => 'Grille à jour', 'ib' => null],
            'reclamations' => ['recues' => 4, 'satisfaites' => 3],
            'accidents_travail' => 2,
            'engagements' => [['prevu' => 4, 'realise' => 3], ['prevu' => 2, 'realise' => 2], ['prevu' => null, 'realise' => null]],
            'plan_action' => ['actions' => 5, 'echues' => 2, 'cloturees' => 1, 'recommandation' => 'Former les agents'],
        ]]);
        RapportPs09::create(['annee' => $annee, 'trimestre' => 0, 'donnees' => [
            'stages' => ['besoins' => 6, 'stagiaires' => 4, 'actions_amelioration' => 1],
            'polyvalence' => ['competences' => 7, 'taches' => 10],
            'recrutement' => ['besoins' => 4],
            'exigences' => ['controleurs' => 8, 'pompiers' => 13],
        ]]);
    }

    /** @return array{0: Worksheet, 1: string, 2: mixed, 3: \PhpOffice\PhpSpreadsheet\Spreadsheet, 4: string} */
    private function exporter(int $annee = 2026, int $trimestre = 3, array $extra = []): array
    {
        $response = $this->get('/api/rapport-activite/export?'.http_build_query(['annee' => $annee, 'trimestre' => $trimestre] + $extra));
        $response->assertOk();
        $chemin = $response->baseResponse->getFile()->getPathname();

        $zip = new \ZipArchive();
        $zip->open($chemin);
        $xml = $zip->getFromName('xl/worksheets/sheet2.xml');
        $chart = $zip->getFromName('xl/charts/chart1.xml');
        $zip->close();
        $wb = IOFactory::load($chemin);
        @unlink($chemin);

        $visibles = array_values(array_filter($wb->getAllSheets(), fn ($s) => $s->getSheetState() === 'visible'));
        $this->assertCount(1, $visibles);

        return [$visibles[0], $xml, $response, $wb, $chart];
    }

    private function valeurs(Worksheet $ws, array $cellules): array
    {
        // Les textes écrits par la plateforme sont des chaînes « inline », relues en RichText.
        return array_map(fn ($c) => ($v = $ws->getCell($c)->getValue()) instanceof RichText ? $v->getPlainText() : $v, $cellules);
    }

    public function test_export_place_chaque_saisie_sur_la_ligne_de_sa_periode(): void
    {
        $this->saisir();
        [$ws] = $this->exporter();

        $c = $this->commentaires;
        $this->assertSame('Bonne efficacité', $ws->getCell('I'.($c['I.A - Evaluation'] + 2))->getFormattedValue());
        $this->assertSame('R&D <test>', $ws->getCell('I'.($c['I.F- Accidents de Travail'] + 2))->getFormattedValue());
        $this->assertSame('Grille à jour', $ws->getCell('I'.($c['IV.d - Polyvalence du Personnel'] + 2))->getFormattedValue());

        // Fenêtre 3T25 … 4T26 : « 3 Ttre 26 » est la 5e ligne.
        $this->assertSame(['3 Ttre 25', '4Ttre 25', '1° Tre 26', '2 Ttre 26', '3 Ttre 26', '4 Ttre 26'], $this->valeurs($ws, ['C201', 'C202', 'C203', 'C204', 'C205', 'C206']));
        $this->assertSame(2, $ws->getCell('Q205')->getValue());
        $this->assertSame(['3 Ttre 25', '3 Ttre 26'], $this->valeurs($ws, ['B226', 'B230']));
        $this->assertSame([4, 3, 1], $this->valeurs($ws, ['C230', 'D230', 'E230']));
        $this->assertSame([9, 9], $this->valeurs($ws, ['C226', 'C227'])); // 3T25 et 4T25 : valeurs du fichier
        $this->assertSame(['Encours de traitement', null], $this->valeurs($ws, ['H226', 'H230'])); // la note suit 3T25

        // Engagements : mois 2026, juillet = 7e ligne.
        $this->assertSame((int) XlsDate::formattedPHPToExcel(2026, 7, 1), $ws->getCell('B245')->getValue());
        $this->assertSame([4, 3, 2, 2, null], $this->valeurs($ws, ['C245', 'D245', 'C246', 'D246', 'C247']));
        $this->assertSame(['1° Tre 26', '4° Tre 26'], $this->valeurs($ws, ['F253', 'F256']));

        $this->assertSame([5, 2, 1], $this->valeurs($ws, ['E'.$this->plan, 'E'.($this->plan + 1), 'E'.($this->plan + 2)]));
        $this->assertSame('Former les agents', $ws->getCell('I'.$this->plan)->getFormattedValue());

        $this->assertSame([2026, 6, 4, 1], $this->valeurs($ws, ['B269', 'C269', 'D269', 'E269'])); // stagiaires 2020 … 2026
        $this->assertSame([2026, 7, 10], $this->valeurs($ws, ['B283', 'E283', 'F283'])); // polyvalence 2021 … 2026
    }

    public function test_formations_sur_la_ligne_de_leur_trimestre(): void
    {
        $formation = fn (string $debut) => Formation::forceCreate(['intitule' => 'F', 'date_debut' => $debut, 'date_fin' => $debut]);
        $formation('2026-05-10');
        $formation('2026-05-20');
        $formation('2026-06-30'); // dernier jour du T2
        foreach (['2026-07-01', '2026-08-15', '2026-09-30'] as $d) {
            $formation($d);
        }

        [$ws] = $this->exporter(2026, 3);

        $this->assertSame(7, $ws->getCell('F201')->getValue()); // « 3 Ttre 25 » : valeur du fichier
        $this->assertSame(3, $ws->getCell('F204')->getValue()); // « 2 Ttre 26 »
        $this->assertSame(3, $ws->getCell('F205')->getValue()); // « 3 Ttre 26 »
        $this->assertSame([null, null, null, null, null], $this->valeurs($ws, ['F206', 'G206', 'J206', 'M206', 'Q206'])); // T4 futur
        $this->assertSame('=G205/F205', $ws->getCell('H205')->getValue());
        $this->assertSame(['Nomb Totale des formations réalisées 2026'], $this->valeurs($ws, ['B208']));
    }

    public function test_annee_cumulee_jusqu_a_la_fin_du_trimestre(): void
    {
        foreach (['900001' => '2026-02-03', '900002' => '2026-02-20', '900003' => '2026-08-10'] as $mat => $date) {
            Employe::forceCreate(['matricule' => $mat, 'nom' => 'N', 'prenom' => 'P', 'fonction' => 'Pompier', 'statut' => 'actif', 'date_embauche' => $date]);
        }

        [$ws] = $this->exporter(2026, 1);

        $this->assertSame([2021, 2026, 2027], $this->valeurs($ws, ['B211', 'B216', 'B217'])); // recrutement 2021 … 2027
        $this->assertSame([2, 2], $this->valeurs($ws, ['I216', 'E216']));
        $this->assertSame([9, 9], $this->valeurs($ws, ['I215', 'E215'])); // 2025 terminée : fichier
        $this->assertSame([null, null], $this->valeurs($ws, ['I217', 'E217'])); // 2027 : future

        // Rapport T1 2025 : l'année 2025 n'est pas terminée → cumul plateforme, pas le total annuel du fichier.
        [$ws] = $this->exporter(2025, 1);
        $this->assertSame([2025, 0, 9], $this->valeurs($ws, ['B216', 'I216', 'I215']));

        $this->getJson('/api/rapport-activite?annee=2026&trimestre=1')->assertOk()->assertJsonPath('effectif.integres', 2);
    }

    public function test_lignes_futures_vides(): void
    {
        $this->saisir();
        [$ws] = $this->exporter(2026, 2);

        $this->assertSame([null, null, null, null], $this->valeurs($ws, ['F205', 'F206', 'Q205', 'Q206'])); // T3, T4 2026
        $this->assertSame([null, null, null, null], $this->valeurs($ws, ['C230', 'D230', 'C231', 'D231']));
        foreach (range(245, 250) as $l) { // juillet … décembre 2026
            $this->assertSame([null, null], $this->valeurs($ws, ["C$l", "D$l"]));
        }
        $this->assertSame((int) XlsDate::formattedPHPToExcel(2026, 6, 30), $ws->getCell('F5')->getValue());
    }

    public function test_commentaires_du_modele_retires(): void
    {
        [$ws] = $this->exporter(2026, 1);

        foreach ($this->commentaires as $titre => $ligne) {
            $this->assertNull($ws->getCell('I'.($ligne + 2))->getValue(), $titre);
        }
        $this->assertNull($ws->getCell('I'.$this->plan)->getValue());
        $this->assertNull($ws->getCell('E'.$this->plan)->getValue());
    }

    public function test_saisie_l_emporte_sur_le_fichier(): void
    {
        RapportPs09::create(['annee' => 2025, 'trimestre' => 3, 'donnees' => ['reclamations' => ['recues' => 4, 'satisfaites' => 3]]]);

        [$ws] = $this->exporter(2025, 3);

        $this->assertSame(['3 Ttre 24', '3 Ttre 25'], $this->valeurs($ws, ['B226', 'B230']));
        $this->assertSame([4, 3, 1], $this->valeurs($ws, ['C230', 'D230', 'E230']));
        $this->assertSame(9, $ws->getCell('C229')->getValue()); // 2T25 : valeur du fichier
        $this->assertSame([null, null], $this->valeurs($ws, ['C231', 'F206'])); // 4T25 : futur
        $this->assertSame([9, 9], $this->valeurs($ws, ['D297', 'E297'])); // covid 3T24 : fichier
    }

    public function test_liste_recrutements_depuis_la_plateforme(): void
    {
        Employe::forceCreate(['matricule' => '900001', 'nom' => 'A', 'prenom' => 'B', 'fonction' => 'Contrôleur', 'statut' => 'actif', 'date_embauche' => '2026-03-10']);
        Employe::forceCreate(['matricule' => '900002', 'nom' => 'C', 'prenom' => 'D', 'fonction' => 'Contrôleur', 'statut' => 'actif', 'date_embauche' => '2026-03-20']);
        Employe::forceCreate(['matricule' => '900003', 'nom' => 'E', 'prenom' => 'F', 'fonction' => 'Pompier', 'statut' => 'actif', 'date_embauche' => '2026-08-01']);

        [$ws] = $this->exporter(2026, 1);

        $this->assertSame(
            ['2. Recrutement en Mars 2026 pour le poste de Contrôleur', null, null],
            $this->valeurs($ws, array_map(fn ($l) => "B$l", $this->listeRecrutements))
        );
    }

    public function test_feuille_unique_nommee_et_datee(): void
    {
        [$ws, , , $wb, $chart] = $this->exporter(2026, 3);

        $this->assertSame('E3 Rap Act Sep 2026', $ws->getTitle());
        $this->assertSame((int) XlsDate::formattedPHPToExcel(2026, 9, 30), $ws->getCell('F5')->getValue());
        $this->assertSame('hidden', $wb->getSheetByName('E3 Rap Act Sep 2025')->getSheetState());
        $this->assertStringContainsString("'E3 Rap Act Sep 2026'!\$C\$201", $chart);
    }

    public function test_collision_nom_feuille(): void
    {
        [$ws, , , $wb, $chart] = $this->exporter(2025, 3);

        $this->assertSame('E3 Rap Act Sep 2025', $ws->getTitle());
        $this->assertSame(['3 Ttre 24'], $this->valeurs($ws, ['C201']));
        $archive = $wb->getSheetByName('E3 Rap Act Sep 2025 (archive)');
        $this->assertSame('hidden', $archive->getSheetState());
        $this->assertSame('témoin feuille 2025', $archive->getCell('A1')->getValue());
        $this->assertStringContainsString("'E3 Rap Act Sep 2025'!\$C\$201", $chart);
    }

    public function test_donnees_plateforme_recrutement_et_postes(): void
    {
        Employe::forceCreate(['matricule' => '900001', 'nom' => 'A', 'prenom' => 'B', 'fonction' => 'Contrôleur', 'statut' => 'actif', 'date_embauche' => '2026-08-10']);
        Employe::forceCreate(['matricule' => '900002', 'nom' => 'C', 'prenom' => 'D', 'fonction' => 'Pompier', 'statut' => 'actif', 'date_embauche' => '2015-01-01']);
        Employe::forceCreate(['matricule' => '900003', 'nom' => 'E', 'prenom' => 'F', 'fonction' => 'Pompier', 'statut' => 'retraite', 'date_embauche' => '2000-01-01']);

        $this->getJson('/api/rapport-activite?annee=2026&trimestre=3')
            ->assertOk()
            ->assertJsonPath('postes', ['controleurs' => 1, 'pompiers' => 1])
            ->assertJsonPath('recrutements', [['mois' => 8, 'fonction' => 'Contrôleur', 'nombre' => 1]]);

        $this->saisir();
        [$ws] = $this->exporter();

        $this->assertSame([2026, 4, 1], $this->valeurs($ws, ['B216', 'D216', 'E216']));
        $this->assertSame(9, $ws->getCell('D215')->getValue()); // besoins 2025 : fichier
        $this->assertSame([8, 13, 1, 1], $this->valeurs($ws, ['C222', 'D222', 'C223', 'D223']));
        $this->assertSame('=C222+D222', $ws->getCell('E222')->getValue());
    }

    public function test_formules_conservees_et_xml_valide(): void
    {
        $this->saisir();
        [$ws, $xml] = $this->exporter();

        $this->assertSame('=G201/F201', $ws->getCell('H201')->getValue());
        $this->assertSame('=D230/C230', $ws->getCell('F230')->getValue());
        $this->assertSame('=D245/C245', $ws->getCell('G245')->getValue());
        $this->assertSame('=E283/F283', $ws->getCell('D283')->getValue());
        $this->assertSame('=E215/D215', $ws->getCell('H288')->getValue());
        $this->assertSame(['Satisfaction en Recrutement  2024', 'Satisfaction en Recrutement  2025'], $this->valeurs($ws, ['B287', 'B288']));
        // Titres collés sous les tableaux : ni renommés ni vidés.
        $this->assertSame(['1 - Taux de Satisfaction en Recrutement :', '1 - Suivi le risque de contamination au covid'], $this->valeurs($ws, ['B284', 'B270']));

        $ref = 'I'.($this->commentaires['I.F- Accidents de Travail'] + 2);
        $this->assertMatchesRegularExpression('#<c r="'.$ref.'"[^>]*t="inlineStr"[^>]*><is><t xml:space="preserve">R&amp;D &lt;test&gt;</t></is></c>#', $xml);
    }

    public function test_apercu_identique_a_l_export_et_sans_fichier(): void
    {
        $this->saisir(2027); // 2027 n'existe dans aucun tableau du modèle : les libellés glissent
        $avant = glob(storage_path('app/rapport-*')) ?: [];

        $apercu = $this->getJson('/api/rapport-activite/export/apercu?annee=2027&trimestre=3')->assertOk()->json();

        $this->assertSame($avant, glob(storage_path('app/rapport-*')) ?: []);
        $this->assertSame('E3 Rap Act Sep 2027', $apercu['sheet']);
        $this->assertContains(['libelle' => 'Stages 2027 — besoins identifiés', 'cellule' => 'C269'], $apercu['places']);
        $this->assertContains(['libelle' => 'Accidents de travail — T3 2027', 'cellule' => 'Q205'], $apercu['places']);
        $this->assertContains(['libelle' => 'I.F — Commentaire', 'cellule' => 'I'.($this->commentaires['I.F- Accidents de Travail'] + 2)], $apercu['places']);

        [, , $response] = $this->exporter(2027);
        $entete = $response->headers->get('X-PS09-Non-Placees');
        $this->assertSame(mb_convert_encoding($entete, 'ASCII'), $entete);
        $this->assertSame($apercu['non_places'], json_decode($entete, true));
    }

    public function test_visuel_html_contient_les_saisies_sans_fichier_restant(): void
    {
        $this->saisir();
        $avant = glob(storage_path('app/rapport-*')) ?: [];

        $r = $this->get('/api/rapport-activite/export/visuel?annee=2026&trimestre=3')
            ->assertOk()->assertHeader('Content-Type', 'text/html; charset=UTF-8');

        $this->assertStringContainsString('Bonne efficacité', $r->getContent());
        $this->assertStringContainsString('R&amp;D &lt;test&gt;', $r->getContent()); // texte échappé, pas de HTML injecté
        $this->assertStringNotContainsString('ancien commentaire', $r->getContent());
        $this->assertSame($avant, glob(storage_path('app/rapport-*')) ?: []);
    }

    public function test_parametre_sheet_ignore_et_route_sheets_supprimee(): void
    {
        $this->getJson('/api/rapport-activite/sheets')->assertNotFound();

        $sans = $this->getJson('/api/rapport-activite/export/apercu?annee=2026&trimestre=3')->assertOk()->json();
        $avec = $this->getJson('/api/rapport-activite/export/apercu?sheet=Nimporte&annee=2026&trimestre=3')->assertOk()->json();
        $this->assertSame($sans, $avec);
    }
}
