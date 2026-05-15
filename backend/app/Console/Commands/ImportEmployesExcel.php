<?php

namespace App\Console\Commands;

use App\Models\Employe;
use App\Models\Service;
use Illuminate\Console\Command;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as XlDate;

class ImportEmployesExcel extends Command
{
    protected $signature   = 'import:employes {fichier : Chemin complet vers le fichier Excel}';
    protected $description = 'Importe les employés depuis un fichier Excel vers la base de données';

    private array $categorieMap = [
        'cadre supér'    => 'Cadre Supérieur',
        'cadre super'    => 'Cadre Supérieur',
        'cadre '         => 'Cadre',
        'cadre'          => 'Cadre',
        'haute maîtrise' => 'Haute Maîtrise',
        'haute maitrise' => 'Haute Maîtrise',
        'maîtrise'       => 'Maîtrise',
        'maitrise'       => 'Maîtrise',
        'exécution prin' => 'Exécution Principal',
        'execution prin' => 'Exécution Principal',
        'exécution '     => 'Exécution',
        'exécution'      => 'Exécution',
        'execution'      => 'Exécution',
    ];

    private array $sexeMap = [
        'homme' => 'M',
        'femme' => 'F',
        'm'     => 'M',
        'f'     => 'F',
    ];

    public function handle(): int
    {
        $fichier = $this->argument('fichier');

        if (! file_exists($fichier)) {
            $this->error("Fichier introuvable : $fichier");
            return self::FAILURE;
        }

        $this->info('Chargement du fichier Excel...');
        $spreadsheet = IOFactory::load($fichier);
        $sheet       = $spreadsheet->getActiveSheet();
        $rows        = $sheet->toArray(null, true, true, false);

        array_shift($rows); // retirer l'en-tête

        $inserted = 0;
        $skipped  = 0;
        $errors   = [];

        $this->info('Traitement de '.count($rows).' lignes...');
        $bar = $this->output->createProgressBar(count($rows));
        $bar->start();

        foreach ($rows as $index => $row) {
            $line = $index + 2;

            try {
                // Col: 0=Mle 1=Nom 2=Prénom 3=Sexe 4=DateNaissance 5=Age(calc)
                //      6=DateEmbauche 7=Ancienneté(calc) 8=Catégorie 9=Echelle
                //      10=Echelon 11=Entité 12=Fonction 13=Qualification
                //      14=Affectation(label) 15=DateAffectation 16=Mutation(label)
                //      17=DateMutation 18=Retraite(label) 19=DateRetraite
                //      20=DépartVolontaire(label) 21=DateDV 22=OB

                $matricule = trim((string) ($row[0] ?? ''));
                if ($matricule === '') {
                    $bar->advance();
                    continue;
                }

                $entiteNom = trim((string) ($row[11] ?? ''));
                $service   = $this->getOrCreateService($entiteNom);

                $sexeRaw  = strtolower(trim((string) ($row[3] ?? '')));
                $sexe     = $this->sexeMap[$sexeRaw] ?? 'M';

                $categorieRaw = strtolower(trim((string) ($row[8] ?? '')));
                $categorie    = $this->normaliserCategorie($categorieRaw);

                $dateNaissance   = $this->parseDate($row[4]);
                $dateEmbauche    = $this->parseDate($row[6]);
                $dateAffectation = $this->parseDate($row[15]);
                $dateMutation    = $this->parseDate($row[17]);
                $dateRetraite    = $this->parseDate($row[19]);
                $dateDV          = $this->parseDate($row[21]);

                $retraite         = ! empty(trim((string) ($row[18] ?? '')));
                $departVolontaire = ! empty(trim((string) ($row[20] ?? '')));
                $hasMutation      = ! empty(trim((string) ($row[16] ?? '')));

                $statut = 'actif';
                if ($retraite)            $statut = 'retraite';
                elseif ($departVolontaire) $statut = 'parti';
                elseif ($hasMutation)      $statut = 'mute';

                Employe::updateOrCreate(
                    ['matricule' => $matricule],
                    [
                        'nom'                    => strtoupper(trim((string) ($row[1] ?? ''))),
                        'prenom'                 => $this->titleCase(trim((string) ($row[2] ?? ''))),
                        'sexe'                   => $sexe,
                        'date_naissance'         => $dateNaissance,
                        'date_embauche'          => $dateEmbauche,
                        'categorie'              => $categorie,
                        'echelle'                => trim((string) ($row[9] ?? '')) ?: null,
                        'echelon'                => trim((string) ($row[10] ?? '')) ?: null,
                        'entite'                 => $entiteNom ?: null,
                        'fonction'               => trim((string) ($row[12] ?? '')) ?: null,
                        'qualification'          => trim((string) ($row[13] ?? '')) ?: null,
                        'service_id'             => $service->id,
                        'affectation'            => $dateAffectation ? 'Affectation' : null,
                        'date_affectation'       => $dateAffectation,
                        'mutation'               => $hasMutation ? 'Mutation' : null,
                        'date_mutation'          => $dateMutation,
                        'retraite'               => $retraite,
                        'date_retraite'          => $dateRetraite,
                        'depart_volontaire'      => $departVolontaire,
                        'date_depart_volontaire' => $dateDV,
                        'observation'            => trim((string) ($row[22] ?? '')) ?: null,
                        'solde_conge'            => 0,
                        'statut'                 => $statut,
                    ]
                );

                $inserted++;

            } catch (\Throwable $e) {
                $errors[] = "Ligne $line (matricule={$row[0]}): ".$e->getMessage();
                $skipped++;
            }

            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);

        $this->info("✓ Importés / mis à jour : $inserted");

        if ($skipped > 0) {
            $this->warn("✗ Ignorés avec erreur   : $skipped");
            foreach ($errors as $err) {
                $this->warn("  → $err");
            }
        }

        $this->info('Services en base  : '.Service::count());
        $this->info('Employés en base  : '.Employe::count());

        return self::SUCCESS;
    }

    private function getOrCreateService(string $nom): Service
    {
        if ($nom === '') {
            return Service::firstOrCreate(['nom' => 'Non défini']);
        }

        $lower   = strtolower($nom);
        $domaine = null;
        if (str_contains($lower, 'navigation'))                                         $domaine = 'Navigation Aérienne';
        elseif (str_contains($lower, 'technique'))                                      $domaine = 'Technique';
        elseif (str_contains($lower, 'exploitation'))                                   $domaine = 'Exploitation';
        elseif (str_contains($lower, 'sûreté') || str_contains($lower, 'sureté')
             || str_contains($lower, 'securite') || str_contains($lower, 'qualité'))    $domaine = 'Sûreté & Qualité';

        return Service::firstOrCreate(['nom' => $nom], ['domaine' => $domaine]);
    }

    private function normaliserCategorie(string $raw): ?string
    {
        foreach ($this->categorieMap as $key => $val) {
            if (str_starts_with($raw, $key)) {
                return $val;
            }
        }
        return $raw ?: null;
    }

    private function parseDate(mixed $val): ?string
    {
        if ($val === null || $val === '') return null;

        if ($val instanceof \DateTime) {
            return $val->format('Y-m-d');
        }

        if (is_numeric($val)) {
            try {
                return XlDate::excelToDateTimeObject((float) $val)->format('Y-m-d');
            } catch (\Throwable) {
                return null;
            }
        }

        if (is_string($val)) {
            $val = trim($val);
            foreach (['d/m/Y', 'Y-m-d', 'd-m-Y', 'd/m/y'] as $fmt) {
                $dt = \DateTime::createFromFormat($fmt, $val);
                if ($dt !== false) return $dt->format('Y-m-d');
            }
        }

        return null;
    }

    private function titleCase(string $str): string
    {
        return mb_convert_case($str, MB_CASE_TITLE, 'UTF-8');
    }
}
