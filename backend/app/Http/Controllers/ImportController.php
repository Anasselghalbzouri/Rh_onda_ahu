<?php

namespace App\Http\Controllers;

use App\Models\Employe;
use App\Models\Service;
use Illuminate\Http\Request;

class ImportController extends Controller
{
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

    public function syncFromExcel(Request $request): \Illuminate\Http\JsonResponse
    {
        $rows = $request->input('employes', []);

        if (empty($rows)) {
            return response()->json(['error' => 'Aucune donnée reçue.'], 422);
        }

        $inserted = 0;
        $updated  = 0;
        $skipped  = 0;
        $errors   = [];

        foreach ($rows as $index => $row) {
            try {
                $matricule = trim((string) ($row['matricule'] ?? ''));
                if ($matricule === '') {
                    $skipped++;
                    continue;
                }

                $entiteNom = trim((string) ($row['entite'] ?? ''));
                $service   = $this->getOrCreateService($entiteNom);

                $sexeRaw      = strtolower(trim((string) ($row['sexe'] ?? '')));
                $sexe         = $this->sexeMap[$sexeRaw] ?? 'M';
                $categorieRaw = strtolower(trim((string) ($row['categorie'] ?? '')));
                $categorie    = $this->normaliserCategorie($categorieRaw);

                $retraite         = ! empty(trim((string) ($row['retraite'] ?? '')));
                $departVolontaire = ! empty(trim((string) ($row['depart_volontaire'] ?? '')));
                $hasMutation      = ! empty(trim((string) ($row['mutation'] ?? '')));

                $statut = 'actif';
                if ($retraite)             $statut = 'retraite';
                elseif ($departVolontaire) $statut = 'parti';
                elseif ($hasMutation)      $statut = 'mute';

                $dateAffectation = $this->parseDate($row['date_affectation'] ?? null);

                $data = [
                    'nom'                    => strtoupper(trim((string) ($row['nom'] ?? ''))),
                    'prenom'                 => mb_convert_case(trim((string) ($row['prenom'] ?? '')), MB_CASE_TITLE, 'UTF-8'),
                    'sexe'                   => $sexe,
                    'date_naissance'         => $this->parseDate($row['date_naissance'] ?? null),
                    'date_embauche'          => $this->parseDate($row['date_embauche'] ?? null),
                    'categorie'              => $categorie,
                    'echelle'                => trim((string) ($row['echelle'] ?? '')) ?: null,
                    'echelon'                => trim((string) ($row['echelon'] ?? '')) ?: null,
                    'entite'                 => $entiteNom ?: null,
                    'fonction'               => trim((string) ($row['fonction'] ?? '')) ?: null,
                    'qualification'          => trim((string) ($row['qualification'] ?? '')) ?: null,
                    'service_id'             => $service->id,
                    'affectation'            => $dateAffectation ? 'Affectation' : null,
                    'date_affectation'       => $dateAffectation,
                    'mutation'               => $hasMutation ? 'Mutation' : null,
                    'date_mutation'          => $this->parseDate($row['date_mutation'] ?? null),
                    'retraite'               => $retraite,
                    'date_retraite'          => $this->parseDate($row['date_retraite'] ?? null),
                    'depart_volontaire'      => $departVolontaire,
                    'date_depart_volontaire' => $this->parseDate($row['date_depart_volontaire'] ?? null),
                    'observation'            => trim((string) ($row['observation'] ?? '')) ?: null,
                    'solde_conge'            => (float) ($row['solde_conge'] ?? 0),
                    'statut'                 => $statut,
                ];

                $exists = Employe::where('matricule', $matricule)->exists();
                Employe::updateOrCreate(['matricule' => $matricule], $data);

                $exists ? $updated++ : $inserted++;

            } catch (\Throwable $e) {
                $errors[] = "Ligne ".($index + 1)." (matricule={$row['matricule']}): ".$e->getMessage();
                $skipped++;
            }
        }

        return response()->json([
            'success'  => true,
            'inserted' => $inserted,
            'updated'  => $updated,
            'skipped'  => $skipped,
            'errors'   => $errors,
            'total_db' => Employe::count(),
        ]);
    }

    private function getOrCreateService(string $nom): Service
    {
        if ($nom === '') {
            return Service::firstOrCreate(['nom' => 'Non défini']);
        }

        $lower   = strtolower($nom);
        $domaine = null;
        if (str_contains($lower, 'navigation'))                                    $domaine = 'Navigation Aérienne';
        elseif (str_contains($lower, 'technique'))                                 $domaine = 'Technique';
        elseif (str_contains($lower, 'exploitation'))                              $domaine = 'Exploitation';
        elseif (str_contains($lower, 'sûreté') || str_contains($lower, 'securite')
             || str_contains($lower, 'qualité'))                                   $domaine = 'Sûreté & Qualité';

        return Service::firstOrCreate(['nom' => $nom], ['domaine' => $domaine]);
    }

    private function normaliserCategorie(string $raw): ?string
    {
        foreach ($this->categorieMap as $key => $val) {
            if (str_starts_with($raw, $key)) return $val;
        }
        return $raw ?: null;
    }

    private function parseDate(mixed $val): ?string
    {
        if ($val === null || $val === '') return null;
        if ($val instanceof \DateTime) return $val->format('Y-m-d');

        $val = trim((string) $val);
        foreach (['d/m/Y', 'Y-m-d', 'd-m-Y', 'm/d/Y'] as $fmt) {
            $dt = \DateTime::createFromFormat($fmt, $val);
            if ($dt !== false) return $dt->format('Y-m-d');
        }
        return null;
    }
}
