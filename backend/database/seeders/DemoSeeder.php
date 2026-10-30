<?php

namespace Database\Seeders;

use App\Models\Employe;
use App\Models\Notification;
use App\Models\Reclamation;
use App\Models\ResponsableRh;
use App\Support\DocumentsEmployesReference;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * Données fictives à noms arabes pour tester toutes les sections de la plateforme.
 * Non appelé par DatabaseSeeder : se lance seulement avec --class=DemoSeeder, et vide
 * la base cible. Il refuse donc toute autre base que demo.sqlite.
 */
class DemoSeeder extends Seeder
{
    // Comptes et jetons conservés : le RH reste connecté avec son mot de passe habituel.
    private const TABLES_CONSERVEES = ['migrations', 'responsable_rh', 'personal_access_tokens'];

    private const PRENOMS_H = [
        'Mohamed', 'Ahmed', 'Youssef', 'Hassan', 'Omar', 'Khalid', 'Abdelilah', 'Rachid', 'Said', 'Mustapha',
        'Hamza', 'Anass', 'Karim', 'Tarik', 'Bilal', 'Ayoub', 'Ismail', 'Yassine', 'Abdelkader', 'Driss',
        'Zakaria', 'Mehdi', 'Soufiane', 'Nabil', 'Jamal', 'Hicham', 'Adil', 'Reda', 'Ibrahim', 'Abdellah',
    ];

    private const PRENOMS_F = [
        'Fatima', 'Khadija', 'Aicha', 'Maryam', 'Salma', 'Nadia', 'Samira', 'Hanane', 'Zineb', 'Imane',
        'Asmae', 'Sanaa', 'Laila', 'Naima', 'Houda', 'Karima', 'Rajae', 'Souad', 'Amina', 'Hajar',
    ];

    private const NOMS = [
        'EL AMRANI', 'BENALI', 'EL IDRISSI', 'AL ALAOUI', 'BENNANI', 'EL FASSI', 'CHAOUI', 'TAZI', 'BERRADA', 'EL OUAFI',
        'ZIANI', 'EL KHATTABI', 'AMEZIANE', 'EL HASSANI', 'SLAOUI', 'BOUAZZA', 'EL MANSOURI', 'LAHLOU', 'KETTANI', 'SQALLI',
        'EL AZZOUZI', 'BOUDRA', 'EL HARTI', 'RAHMANI', 'SAIDI', 'MEKKAOUI', 'EL OMARI', 'NACIRI', 'HAJJI', 'TOUHAMI',
    ];

    private const POSTES = [
        "Division de l'aéroport" => ['Chef de Division', 'Employé de Bureau', 'Femme de Ménage', 'Chauffeur'],
        'Exploitation Aéroportuaire' => ["Agent d'Aérogare", 'Chef de Quart', 'Agent de Piste'],
        'Navigation Aérienne' => ['Contrôleur', 'Contrôleuse', 'Assistant Contrôle'],
        'Sûreté,Sécurité, Qualité, Environnement' => ['Pompier', 'Agent de Sûreté', 'Responsable Qualité'],
        'Technique Navigation' => ['Electronicien', 'Electronicienne', 'Technicien Maintenance'],
    ];

    private const CATEGORIES = ['Cadre Supér', 'Cadre', 'Haute Maîtrise', 'Maîtrise', 'Exécution Prin', 'Exécution'];

    private const QUALIFICATIONS = ['Bac+5', 'Bac+4', 'Bac+3', 'Bac+2', 'Bac', 'Niveau Bac', 'Niveau Secondaire'];

    private const TYPES_RECLAMATION = [
        'Prime de formation après la confirmation',
        'Erreur dans le calcul d\'un ordre de mission',
        'Demande de certificat d\'immatriculation AMO',
        'Retard de remboursement de dossier médical',
        'Régularisation de la situation administrative',
        'Attestation de travail non reçue',
        'Solde de congé erroné',
    ];

    private const CANAUX_RECLAMATION = ['Fiche de réclamation', 'E-mail', 'Verbale', 'Courrier'];

    public function run(): void
    {
        $this->verifierCible();
        $this->vider();
        $this->remplir();
    }

    public function verifierCible(): void
    {
        $base = str_replace('\\', '/', (string) DB::connection()->getDatabaseName());

        if (app()->isProduction() || ! str_ends_with($base, '/demo.sqlite')) {
            throw new RuntimeException('DemoSeeder vide la base : il ne s\'exécute que sur database/demo.sqlite, hors production.');
        }
    }

    private function vider(): void
    {
        Schema::withoutForeignKeyConstraints(function () {
            foreach (Schema::getTableListing(schemaQualified: false) as $table) {
                if (! in_array($table, self::TABLES_CONSERVEES, true) && ! str_starts_with($table, 'sqlite_')) {
                    DB::table($table)->delete();
                }
            }
            DB::table('sqlite_sequence')->whereNotIn('name', self::TABLES_CONSERVEES)->delete();
        });
    }

    /** PDF d'une page lisible : une page blanche ferait croire à un aperçu cassé. */
    public function pdfFictif(string $categorie, object $employe): string
    {
        $lignes = ['DOCUMENT FICTIF DE TEST', $categorie, "{$employe->prenom} {$employe->nom}", "Matricule : {$employe->matricule}"];
        $flux = "BT /F1 16 Tf 60 720 Td 28 TL\n";
        foreach ($lignes as $ligne) {
            $flux .= '('.addcslashes(mb_convert_encoding($ligne, 'Windows-1252', 'UTF-8'), '\\()').") Tj T*\n";
        }
        $flux .= 'ET';

        $objets = [
            '<</Type/Catalog/Pages 2 0 R>>',
            '<</Type/Pages/Kids[3 0 R]/Count 1>>',
            '<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>',
            '<</Length '.strlen($flux).">>stream\n{$flux}\nendstream",
            '<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>',
        ];

        $pdf = "%PDF-1.4\n";
        $positions = [];
        foreach ($objets as $i => $objet) {
            $positions[] = strlen($pdf);
            $pdf .= ($i + 1)." 0 obj\n{$objet}\nendobj\n";
        }

        $xref = strlen($pdf);
        $pdf .= "xref\n0 6\n0000000000 65535 f \n";
        foreach ($positions as $position) {
            $pdf .= sprintf("%010d 00000 n \n", $position);
        }

        return $pdf."trailer<</Size 6/Root 1 0 R>>\nstartxref\n{$xref}\n%%EOF\n";
    }

    public function remplir(): void
    {
        mt_srand(2026);
        Storage::disk('local')->deleteDirectory('pieces_jointes/demo');

        $services = $this->creerServices();
        $employes = $this->creerEmployes($services);

        $this->creerConges($employes);
        $this->creerFormations($employes);
        $this->creerDocuments($employes);
        $this->creerReclamations($employes);
        $this->creerRapportsPs09();
        $this->creerNotifications();
    }

    private function hasard(array $liste): mixed
    {
        return $liste[mt_rand(0, count($liste) - 1)];
    }

    /** Date aléatoire entre deux dates, jamais après $fin. */
    private function dateEntre(Carbon $debut, Carbon $fin): Carbon
    {
        return $debut->copy()->addDays(mt_rand(0, max(0, (int) $debut->diffInDays($fin))));
    }

    /** @return array<string, int> */
    private function creerServices(): array
    {
        $ids = [];
        foreach (array_keys(self::POSTES) as $nom) {
            $ids[$nom] = DB::table('service')->insertGetId(['nom' => $nom]);
        }

        return $ids;
    }

    /**
     * @param  array<string, int>  $services
     * @return Collection<int, Employe>
     */
    private function creerEmployes(array $services): Collection
    {
        $statuts = [...array_fill(0, 100, 'actif'), ...array_fill(0, 5, 'mute'), ...array_fill(0, 6, 'retraite'), ...array_fill(0, 4, 'parti'), ...array_fill(0, 5, 'suspendu')];
        shuffle($statuts);

        $employes = collect();

        // Le compte RH garde une fiche, comme dans la base réelle, sous un nom fictif.
        foreach (ResponsableRh::pluck('login') as $login) {
            $employes->push($this->creerEmploye((string) $login, 'actif', $services, 'Responsable RH'));
        }

        foreach ($statuts as $i => $statut) {
            // Les premiers matricules ont des zéros de tête pour tester leur conservation.
            $matricule = $i < 5 ? sprintf('%05d', 412 + $i) : (string) (90001 + $i);
            $employes->push($this->creerEmploye($matricule, $statut, $services));
        }

        return $employes;
    }

    /** @param  array<string, int>  $services */
    private function creerEmploye(string $matricule, string $statut, array $services, ?string $poste = null): Employe
    {
        $femme = mt_rand(1, 100) <= 25;
        $service = $this->hasard(array_keys(self::POSTES));
        $naissance = $this->dateEntre(now()->subYears(61), now()->subYears(24));
        $embauche = $this->dateEntre($naissance->copy()->addYears(22), now()->subMonths(6));
        $categorie = $this->hasard(self::CATEGORIES);
        $parti = $this->dateEntre($embauche, now());

        $employe = Employe::create([
            'matricule' => $matricule,
            'nom' => $this->hasard(self::NOMS),
            'prenom' => $this->hasard($femme ? self::PRENOMS_F : self::PRENOMS_H),
            'sexe' => $femme ? 'F' : 'M',
            'date_naissance' => $naissance,
            'date_embauche' => $embauche,
            'categorie' => $categorie,
            'echelle' => (string) mt_rand(3, 26),
            'echelon' => (string) mt_rand(1, 9),
            'entite' => $service,
            'fonction' => $poste ?? $this->hasard(self::POSTES[$service]),
            // Quelques fiches incomplètes pour tester les affichages sans valeur.
            'qualification' => mt_rand(1, 100) <= 8 ? null : $this->hasard(self::QUALIFICATIONS),
            'service_id' => $services[$service],
            'affectation' => 'Aéroport Al Hoceima',
            'date_affectation' => $embauche,
            'mutation' => $statut === 'mute' ? 'Aéroport Mohammed V' : null,
            'date_mutation' => $statut === 'mute' ? $parti : null,
            'retraite' => $statut === 'retraite',
            'date_retraite' => $statut === 'retraite' ? $parti : null,
            'depart_volontaire' => $statut === 'parti',
            'date_depart_volontaire' => $statut === 'parti' ? $parti : null,
            'observation' => mt_rand(1, 100) <= 10 ? 'Donnée fictive de test.' : null,
            'solde_conge' => mt_rand(0, 90) / 2,
            'statut' => $statut,
        ]);

        // Une carrière antérieure pour tester l'historique : les départs n'ont pas de période ouverte.
        if (mt_rand(1, 100) <= 35 && $embauche->lt(now()->subYears(4))) {
            DB::table('historique_professionnel')->insert([
                'employe_id' => $employe->id,
                'poste' => 'Agent stagiaire',
                'service' => $service,
                'categorie' => 'Exécution',
                'echelle' => '3',
                'date_debut' => $embauche->copy()->subYears(2)->toDateString(),
                'date_fin' => $embauche->copy()->subDay()->toDateString(),
            ]);
        }

        return $employe;
    }

    /** @param  Collection<int, Employe>  $employes */
    private function creerConges(Collection $employes): void
    {
        $rhId = ResponsableRh::value('id');
        $motifs = ['Congé annuel', 'Raison familiale', 'Convalescence', 'Événement familial', null];

        for ($i = 1; $i <= 150; $i++) {
            $employe = $employes->random();
            $debut = $this->dateEntre(now()->subYears(2)->startOfYear(), now()->addMonths(2));
            $jours = mt_rand(1, 22);
            $statut = $this->hasard(['approuve', 'approuve', 'approuve', 'approuve', 'en_attente', 'refuse']);
            $decidee = $statut !== 'en_attente';

            DB::table('demande_conge')->insert([
                'employe_id' => $employe->id,
                'rh_id' => $decidee ? $rhId : null,
                'type_conge' => $this->hasard(['annuel', 'annuel', 'annuel', 'maladie', 'maternite', 'sans_solde', 'exceptionnel']),
                'date_debut' => $debut->toDateString(),
                'date_fin' => $debut->copy()->addDays($jours - 1)->toDateString(),
                'nombre_jours' => $jours,
                'solde_restant' => max(0, $employe->solde_conge - $jours),
                'motif' => $this->hasard($motifs),
                'statut' => $statut,
                'date_decision' => $decidee ? $debut->copy()->subDays(mt_rand(1, 10))->toDateString() : null,
                'commentaire_rh' => $statut === 'refuse' ? 'Effectif insuffisant sur la période.' : null,
                'ref_hraccess' => sprintf('HR-%05d', $i),
                'ref_onda_ahu' => sprintf('AHU-%05d', $i),
                'created_at' => $debut->copy()->subDays(12),
                'updated_at' => $debut->copy()->subDays(12),
            ]);
        }
    }

    /** @param  Collection<int, Employe>  $employes */
    private function creerFormations(Collection $employes): void
    {
        $themes = [
            'Sûreté aéroportuaire', 'Lutte contre l\'incendie', 'Anglais aéronautique', 'Management d\'équipe',
            'Premiers secours', 'Maintenance des équipements radio', 'Qualité et environnement', 'Bureautique',
        ];
        $cours = [];
        foreach ($themes as $theme) {
            $cours[$theme] = DB::table('cours')->insertGetId([
                'theme' => $theme,
                'description' => "Module fictif : {$theme}.",
                'duree_jours' => mt_rand(1, 10),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $annee = now()->year;
        $plans = [
            $annee - 1 => 'valide',
            $annee => 'valide',
            $annee + 1 => 'draft',
        ];
        $actifs = $employes->where('statut', 'actif')->values();

        foreach ($plans as $anneePlan => $statutPlan) {
            $planId = DB::table('plan_formation')->insertGetId([
                'annee' => $anneePlan,
                'titre' => "Plan de formation {$anneePlan}",
                'description' => 'Plan fictif de test.',
                'statut' => $statutPlan,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            foreach ($themes as $theme) {
                $this->creerFormation($theme, $cours[$theme], $planId, $anneePlan, $actifs);
            }
        }
    }

    /** @param  Collection<int, Employe>  $actifs */
    private function creerFormation(string $theme, int $coursId, int $planId, int $annee, Collection $actifs): void
    {
        $mois = mt_rand(1, 12);
        $debut = Carbon::create($annee, $mois, mt_rand(1, 20));
        $duree = mt_rand(1, 8);
        $fin = $debut->copy()->addDays($duree - 1);
        $terminee = $fin->isPast();
        $statut = $terminee ? 'terminee' : ($debut->isPast() ? 'en_cours' : 'planifiee');

        $formationId = DB::table('formation')->insertGetId([
            'plan_formation_id' => $planId,
            'cours_id' => $coursId,
            'intitule' => $theme,
            'type' => $this->hasard(['interne', 'externe']),
            'organisme' => $this->hasard(['Académie ONDA', 'Institut Al Khawarizmi', 'Centre Ibn Sina de formation']),
            'date_debut' => $debut->toDateString(),
            'date_fin' => $fin->toDateString(),
            'duree_jours' => $duree,
            'lieu' => $this->hasard(['Al Hoceima', 'Casablanca', 'Rabat']),
            'cout' => mt_rand(20, 300) * 100,
            'statut' => $statut,
            'objectifs' => "Renforcer les compétences : {$theme}.",
            'mois_prevu' => $mois,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        foreach ($actifs->random(mt_rand(5, 15)) as $employe) {
            $present = $terminee && mt_rand(1, 100) <= 85;

            DB::table('employe_formation')->insert([
                'formation_id' => $formationId,
                'employe_id' => $employe->id,
                'statut' => $terminee ? ($present ? $this->hasard(['present', 'certifie']) : 'absent') : 'inscrit',
                'suivi' => $present,
                'remarque' => $present ? 'Participation satisfaisante.' : null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            if ($present) {
                DB::table('evaluation_formation')->insert([
                    'formation_id' => $formationId,
                    'employe_id' => $employe->id,
                    'note' => mt_rand(8, 20),
                    'commentaire' => $this->hasard(['Très utile', 'Contenu adapté', 'À approfondir']),
                    'date_evaluation' => $fin->copy()->min(now())->toDateString(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    /** @param  Collection<int, Employe>  $employes */
    private function creerDocuments(Collection $employes): void
    {
        $numero = 0;

        foreach ($employes->random(50) as $employe) {
            foreach (collect(DocumentsEmployesReference::CATEGORIES)->random(mt_rand(1, 4)) as $categorie) {
                $numero++;
                $chemin = "pieces_jointes/demo/{$numero}.pdf";
                $pdf = $this->pdfFictif($categorie, $employe);
                Storage::disk('local')->put($chemin, $pdf);

                // Une expiration sur trois : mélange de documents expirés, à renouveler et valides.
                $expiration = $numero % 3 === 0 ? now()->addDays(mt_rand(-60, 200))->toDateString() : null;

                DB::table('pieces_jointes')->insert([
                    'entite' => 'employe',
                    'entite_id' => $employe->id,
                    'nom_original' => str_replace(' ', '_', $categorie)."_{$employe->matricule}.pdf",
                    'nom_stockage' => "{$numero}.pdf",
                    'chemin' => $chemin,
                    'extension' => 'pdf',
                    'taille_octets' => strlen($pdf),
                    'mime_type' => 'application/pdf',
                    'categorie' => $categorie,
                    'description' => 'Document fictif de test.',
                    'date_upload' => now()->subDays(mt_rand(1, 400)),
                    'actif' => true,
                    'date_expiration' => $expiration,
                    'obligatoire' => in_array($categorie, ['Contrat', 'CIN'], true),
                ]);
            }

            DB::table('dossier_personnel')->insert([
                'employe_id' => $employe->id,
                'type_piece' => $this->hasard(['CIN', 'Permis de conduire', 'Certificat médical']),
                'date_expiration' => now()->addDays(mt_rand(-60, 700))->toDateString(),
                'statut' => 'valide',
            ]);
        }
    }

    /** @param  Collection<int, Employe>  $employes */
    private function creerReclamations(Collection $employes): void
    {
        $annee = now()->year;
        $dates = collect();
        foreach ([$annee - 1 => 18, $annee => 27] as $anneeCible => $nombre) {
            $debut = Carbon::create($anneeCible, 1, 1);
            $fin = Carbon::create($anneeCible, 12, 31)->min(now());
            for ($i = 0; $i < $nombre; $i++) {
                $dates->push($this->dateEntre($debut, $fin));
            }
        }

        $compteurs = [];
        foreach ($dates->sortBy(fn (Carbon $d) => $d->toDateString()) as $reception) {
            $compteurs[$reception->year] = ($compteurs[$reception->year] ?? 0) + 1;
            $employe = $employes->random();

            Reclamation::create([
                'numero' => sprintf('%03d/%d', $compteurs[$reception->year], $reception->year),
                'date_reception' => $reception,
                'matricule' => $employe->matricule,
                'nom_complet' => "{$employe->nom} {$employe->prenom}",
                'type' => $this->hasard(self::TYPES_RECLAMATION),
                'description' => 'Réclamation fictive de test : le concerné demande la vérification de son dossier et une réponse écrite du service.',
                'canal' => $this->hasard(self::CANAUX_RECLAMATION),
                ...$this->suiviReclamation($reception),
            ]);
        }

        foreach ($compteurs as $anneeCompteur => $dernier) {
            DB::table('reclamation_compteur')->insert(['annee' => $anneeCompteur, 'dernier' => $dernier]);
        }
    }

    /** @return array<string, mixed> */
    private function suiviReclamation(Carbon $reception): array
    {
        $etat = $this->hasard(['nouvelle', 'en_cours', 'en_cours', 'resolue', 'resolue', 'resolue', 'rejetee']);
        if ($etat === 'nouvelle') {
            return ['etat' => $etat];
        }

        $reponse1 = $this->dateEntre($reception, $reception->copy()->addDays(10)->min(now()));
        $suivi = [
            'etat' => $etat,
            'date_reponse_1' => $reponse1,
            'contenu_reponse_1' => 'Votre dossier a bien été reçu et transmis au service concerné.',
        ];

        if (mt_rand(1, 100) <= 40) {
            $suivi['date_reponse_2'] = $this->dateEntre($reponse1, $reponse1->copy()->addDays(20)->min(now()));
            $suivi['contenu_reponse_2'] = 'Merci de compléter votre dossier avec les pièces demandées.';
        }

        if (in_array($etat, ['resolue', 'rejetee'], true)) {
            $depuis = $suivi['date_reponse_2'] ?? $reponse1;
            $suivi['date_solution'] = $this->dateEntre($depuis, $depuis->copy()->addDays(30)->min(now()));
            $suivi['remarques'] = $etat === 'resolue' ? 'Réglé' : 'Demande non recevable';
        }

        return $suivi;
    }

    /** Les chiffres de réclamations reprennent le registre fictif pour rester cohérents. */
    private function creerRapportsPs09(): void
    {
        $annee = now()->year;
        $commentaire = 'Commentaire fictif de test.';

        foreach ([$annee - 1, $annee] as $anneeRapport) {
            foreach ([1, 2, 3, 4] as $trimestre) {
                if (Carbon::create($anneeRapport, ($trimestre - 1) * 3 + 1, 1)->isFuture()) {
                    continue;
                }

                $reclamations = Reclamation::query()->get()->filter(
                    fn (Reclamation $r) => $r->date_reception->year === $anneeRapport && $r->date_reception->quarter === $trimestre
                );
                $actions = mt_rand(4, 12);

                DB::table('rapport_ps09')->insert([
                    'annee' => $anneeRapport,
                    'trimestre' => $trimestre,
                    'donnees' => json_encode([
                        'reclamations' => [
                            'recues' => $reclamations->count(),
                            'satisfaites' => $reclamations->where('etat', 'resolue')->count(),
                        ],
                        'accidents_travail' => mt_rand(0, 2),
                        'engagements' => array_map(fn () => ['prevu' => mt_rand(3, 8), 'realise' => mt_rand(1, 3)], [1, 2, 3]),
                        'plan_action' => [
                            'actions' => $actions,
                            'echues' => mt_rand(0, $actions),
                            'cloturees' => mt_rand(0, $actions),
                            'recommandation' => 'Poursuivre le suivi trimestriel.',
                        ],
                        'commentaires' => ['ia' => $commentaire, 'id' => $commentaire, 'ivb' => $commentaire],
                    ], JSON_UNESCAPED_UNICODE),
                    'updated_at' => now(),
                ]);
            }

            DB::table('rapport_ps09')->insert([
                'annee' => $anneeRapport,
                'trimestre' => 0,
                'donnees' => json_encode([
                    'stages' => ['besoins' => mt_rand(5, 15), 'stagiaires' => mt_rand(2, 10), 'actions_amelioration' => mt_rand(1, 5)],
                    'polyvalence' => ['competences' => mt_rand(10, 30), 'taches' => mt_rand(10, 30)],
                    'recrutement' => ['besoins' => mt_rand(1, 8)],
                    'exigences' => ['controleurs' => mt_rand(20, 50), 'pompiers' => mt_rand(15, 30)],
                ]),
                'updated_at' => now(),
            ]);
        }
    }

    private function creerNotifications(): void
    {
        Notification::recordExcelSync(12, 30, 'bulk-sync');
        Notification::recordExcelSync(0, 4, 'bulk-sync', 1);
        Notification::recordExcelSync(1, 0, 'bulk-sync');

        // Une notification déjà lue, pour tester les deux états de la cloche.
        Notification::query()->orderBy('id')->limit(1)->update(['lu' => true]);
    }
}
