<?php

namespace App\Http\Controllers;

use App\Models\Employe;
use App\Models\PieceJointe;
use App\Models\Service;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as XlsDate;

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

    public function downloadModele(): \Symfony\Component\HttpFoundation\BinaryFileResponse
    {
        $path = storage_path('app/public/modele_import_employes.xlsx');
        return response()->download($path, 'modele_import_employes.xlsx');
    }

    // Colonnes standardisées A→Q (ligne 1 = en-têtes, données à partir de ligne 2)
    private const COL_MAP = [
        1  => 'matricule',
        2  => 'nom',
        3  => 'prenom',
        4  => 'sexe',
        5  => 'date_naissance',
        6  => 'date_embauche',
        7  => 'categorie',
        8  => 'echelle',
        9  => 'echelon',
        10 => 'entite',
        11 => 'fonction',
        12 => 'qualification',
        13 => 'affectation',
        14 => 'date_affectation',
        15 => 'solde_conge',
        16 => 'statut',
        17 => 'observation',
    ];

    private const DATE_FIELDS = ['date_naissance', 'date_embauche', 'date_affectation'];

    public function importFromFile(Request $request): JsonResponse
    {
        $request->validate([
            'fichier' => 'required|file|mimes:xlsx,xls|max:10240',
        ]);

        $file = $request->file('fichier');

        // Lire le spreadsheet depuis le chemin temporaire avant stockage
        $spreadsheet = IOFactory::load($file->getRealPath());
        $sheet       = $spreadsheet->getActiveSheet();

        // Stocker le fichier
        $path = $file->store('excel', 'public');

        // Enregistrer dans pieces_jointes
        PieceJointe::create([
            'entite'        => 'sync_excel',
            'entite_id'     => auth()->id(),
            'nom_original'  => $file->getClientOriginalName(),
            'nom_stockage'  => basename($path),
            'chemin'        => $path,
            'extension'     => $file->getClientOriginalExtension(),
            'taille_octets' => $file->getSize(),
            'mime_type'     => $file->getMimeType(),
            'categorie'     => 'sync_excel',
            'uploade_par'   => auth()->id(),
            'date_upload'   => now(),
            'actif'         => true,
        ]);

        // Extraire les lignes (ligne 1 = en-têtes)
        $rows        = [];
        $highestRow  = $sheet->getHighestDataRow();

        for ($r = 2; $r <= $highestRow; $r++) {
            $rowData = [];
            foreach (self::COL_MAP as $col => $field) {
                $cell  = $sheet->getCellByColumnAndRow($col, $r);
                $value = $cell->getValue();

                if (in_array($field, self::DATE_FIELDS, true)) {
                    if (is_numeric($value) && $value > 0) {
                        $value = XlsDate::excelToDateTimeObject($value)->format('Y-m-d');
                    } elseif (is_string($value)) {
                        $value = $this->parseDate($value);
                    }
                }

                $rowData[$field] = ($value !== null && $value !== '') ? trim((string) $value) : null;
            }

            if (empty($rowData['matricule'])) continue;
            $rows[] = $rowData;
        }

        // Synchronisation
        $created = 0;
        $updated = 0;
        $errors  = [];

        $syncFields = [
            'nom', 'prenom', 'sexe', 'date_naissance', 'date_embauche',
            'categorie', 'echelle', 'echelon', 'entite', 'fonction',
            'qualification', 'affectation', 'date_affectation',
            'solde_conge', 'statut', 'observation',
        ];

        foreach ($rows as $i => $row) {
            try {
                $fields = array_intersect_key($row, array_flip($syncFields));

                $sexeRaw          = strtolower($fields['sexe'] ?? '');
                $fields['sexe']   = $this->sexeMap[$sexeRaw] ?? 'M';

                $catRaw              = strtolower($fields['categorie'] ?? '');
                $fields['categorie'] = $this->normaliserCategorie($catRaw);

                $fields['solde_conge'] = is_numeric($fields['solde_conge'] ?? null)
                    ? (float) $fields['solde_conge'] : 0;

                $fields['statut'] = $fields['statut'] ?: 'actif';

                $employe = Employe::updateOrCreate(
                    ['matricule' => $row['matricule']],
                    $fields
                );

                $employe->wasRecentlyCreated ? $created++ : $updated++;

            } catch (\Throwable $e) {
                $errors[] = 'Ligne '.($i + 2).': '.$e->getMessage();
            }
        }

        return response()->json([
            'success' => true,
            'fichier' => $file->getClientOriginalName(),
            'total'   => count($rows),
            'created' => $created,
            'updated' => $updated,
            'errors'  => $errors,
        ]);
    }

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
