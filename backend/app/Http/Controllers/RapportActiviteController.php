<?php

namespace App\Http\Controllers;

use App\Models\Employe;
use App\Models\Formation;
use App\Models\RapportPs09;
use App\Services\XlsxSurgicalPatcher;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Writer\Html as HtmlWriter;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class RapportActiviteController extends Controller
{
    /**
     * Indicateurs calculables du rapport PS09 "Rapport d'activité Trimestriel"
     * pour un trimestre/année donné. Ne couvre QUE les indicateurs qui ont une
     * source de données dans la plateforme (formations, effectif) — les
     * indicateurs sans table dédiée (accidents du travail, polyvalence,
     * réclamations, actions d'amélioration, stagiaires...) restent saisis
     * manuellement dans le fichier Excel.
     */
    public function stats(Request $request): JsonResponse
    {
        $data = $request->validate([
            'annee' => 'required|integer|min:2000|max:2100',
            'trimestre' => 'required|integer|min:1|max:4',
        ]);

        return response()->json($this->computeStats((int) $data['annee'], (int) $data['trimestre']));
    }

    private const COMMENTAIRES = ['ia', 'ib', 'ic', 'id', 'ie', 'if', 'ig', 'iva', 'ivb', 'ivc', 'ivd'];

    /**
     * Saisies manuelles PS09 de toute l'année (spec 005) : les 4 trimestres et
     * les données annuelles (trimestre 0).
     */
    public function saisie(Request $request): JsonResponse
    {
        $annee = (int) $request->validate(['annee' => 'required|integer|min:2000|max:2100'])['annee'];

        return response()->json($this->saisieAnnee($annee));
    }

    public function enregistrerSaisie(Request $request, int $annee, int $trimestre): JsonResponse
    {
        abort_if($this->estRole($request, 'dg') || $this->estRole($request, 'employe'), 403, 'Action non autorisée pour ce rôle.');

        $entier = 'nullable|integer|min:0';
        $texte = 'nullable|string|max:2000';
        $rules = [
            'trimestre.reclamations.recues' => $entier,
            'trimestre.reclamations.satisfaites' => $entier,
            'trimestre.accidents_travail' => $entier,
            'trimestre.engagements' => 'nullable|array|size:3',
            'trimestre.engagements.*' => 'array:prevu,realise',
            'trimestre.engagements.*.prevu' => $entier,
            'trimestre.engagements.*.realise' => $entier,
            'trimestre.plan_action.actions' => $entier,
            'trimestre.plan_action.echues' => $entier,
            'trimestre.plan_action.cloturees' => $entier,
            'trimestre.plan_action.recommandation' => $texte,
            'annuel.stages.besoins' => $entier,
            'annuel.stages.stagiaires' => $entier,
            'annuel.stages.actions_amelioration' => $entier,
            'annuel.polyvalence.competences' => $entier,
            'annuel.polyvalence.taches' => $entier,
            'annuel.recrutement.besoins' => $entier,
            'annuel.exigences.controleurs' => $entier,
            'annuel.exigences.pompiers' => $entier,
        ];
        foreach (self::COMMENTAIRES as $c) {
            $rules["trimestre.commentaires.$c"] = $texte;
        }
        // Seules les clés validées sont conservées : une clé inconnue n'est jamais stockée.
        $data = $request->validate($rules);

        $t = $data['trimestre'] ?? null;
        $erreurs = [];
        if (isset($t['reclamations']['recues'], $t['reclamations']['satisfaites']) && $t['reclamations']['satisfaites'] > $t['reclamations']['recues']) {
            $erreurs['trimestre.reclamations.satisfaites'] = 'Les réclamations satisfaites ne peuvent pas dépasser les réclamations reçues.';
        }
        foreach (['echues' => 'Les actions échues', 'cloturees' => 'Les actions clôturées'] as $cle => $libelle) {
            if (isset($t['plan_action']['actions'], $t['plan_action'][$cle]) && $t['plan_action'][$cle] > $t['plan_action']['actions']) {
                $erreurs["trimestre.plan_action.$cle"] = "$libelle ne peuvent pas dépasser le nombre d'actions.";
            }
        }
        if ($erreurs) {
            throw ValidationException::withMessages($erreurs);
        }

        if ($t !== null) {
            RapportPs09::updateOrCreate(['annee' => $annee, 'trimestre' => $trimestre], ['donnees' => $t]);
        }
        if (isset($data['annuel'])) {
            RapportPs09::updateOrCreate(['annee' => $annee, 'trimestre' => 0], ['donnees' => $data['annuel']]);
        }

        return response()->json($this->saisieAnnee($annee));
    }

    private function saisieAnnee(int $annee): array
    {
        $lignes = RapportPs09::where('annee', $annee)->get()->keyBy('trimestre');
        $trimestres = [];
        $modifie = [];
        foreach ([1, 2, 3, 4] as $t) {
            $trimestres[(string) $t] = $lignes->get($t)?->donnees;
            $modifie[(string) $t] = $lignes->get($t)?->updated_at;
        }
        $modifie['annuel'] = $lignes->get(0)?->updated_at;

        return [
            'annee' => $annee,
            'trimestres' => $trimestres,
            'annuel' => $lignes->get(0)?->donnees,
            'modifie_le' => $modifie,
        ];
    }

    /**
     * Génère une copie du classeur PS09 pour le trimestre/année demandé, en
     * modifiant uniquement le XML (les 11 graphiques natifs par feuille restent
     * strictement inchangés — voir App\Services\XlsxSurgicalPatcher).
     */
    public function export(Request $request): BinaryFileResponse
    {
        $data = $request->validate([
            'annee' => 'required|integer|min:2000|max:2100',
            'trimestre' => 'required|integer|min:1|max:4',
        ]);

        $templatePath = config('rapport.ps09_template_path');
        abort_unless(is_file($templatePath), 404, 'Modèle PS09 introuvable sur le serveur.');

        $tempPath = storage_path('app/rapport-export-'.uniqid().'.xlsx');
        $resultat = $this->genererCopie($templatePath, $tempPath, (int) $data['annee'], (int) $data['trimestre']);

        $downloadName = 'PS09_Rapport_activite_'.$data['annee'].'_T'.$data['trimestre'].'.xlsx';

        return response()->download($tempPath, $downloadName, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            // json_encode sans JSON_UNESCAPED_UNICODE : en-tête HTTP en ASCII.
            'X-PS09-Non-Placees' => json_encode($resultat['non_places']),
        ])->deleteFileAfterSend(true);
    }

    /**
     * Récapitulatif avant export (spec 005, FR-012) : même placement que
     * l'export, sur une copie jetable jamais renvoyée.
     */
    public function apercu(Request $request): JsonResponse
    {
        $data = $request->validate([
            'annee' => 'required|integer|min:2000|max:2100',
            'trimestre' => 'required|integer|min:1|max:4',
        ]);

        $templatePath = config('rapport.ps09_template_path');
        abort_unless(is_file($templatePath), 404, 'Modèle PS09 introuvable sur le serveur.');

        $tempPath = storage_path('app/rapport-apercu-'.uniqid().'.xlsx');
        try {
            $resultat = $this->genererCopie($templatePath, $tempPath, (int) $data['annee'], (int) $data['trimestre']);
        } catch (\RuntimeException $e) {
            abort(404, $e->getMessage());
        } finally {
            @unlink($tempPath);
        }

        return response()->json($resultat);
    }

    /**
     * La feuille exportée telle qu'Excel l'affiche (mise en forme, fusions,
     * couleurs, logo), en HTML, pour l'aperçu dans la plateforme. Les
     * graphiques ne sont pas rendus (pas de moteur de graphiques installé).
     */
    public function visuel(Request $request): Response
    {
        $data = $request->validate([
            'annee' => 'required|integer|min:2000|max:2100',
            'trimestre' => 'required|integer|min:1|max:4',
        ]);

        $templatePath = config('rapport.ps09_template_path');
        abort_unless(is_file($templatePath), 404, 'Modèle PS09 introuvable sur le serveur.');

        $tempPath = storage_path('app/rapport-visuel-'.uniqid().'.xlsx');
        try {
            $resultat = $this->genererCopie($templatePath, $tempPath, (int) $data['annee'], (int) $data['trimestre']);

            $reader = IOFactory::createReader('Xlsx');
            $reader->setLoadSheetsOnly([$resultat['sheet']]);
            $html = (new HtmlWriter($reader->load($tempPath)))->setEmbedImages(true)->generateHtmlAll();
        } catch (\RuntimeException $e) {
            abort(404, $e->getMessage());
        } finally {
            @unlink($tempPath);
        }

        return response($html, 200, ['Content-Type' => 'text/html; charset=UTF-8']);
    }

    /** Nom de feuille par trimestre : mois de clôture (research R5). */
    private const MOIS_FEUILLE = ['Mars', 'Juin', 'Sep', 'Déc'];

    // Libellés de trimestre du classeur : « 3 Ttre 23 », « 4Ttre 24 », « 1° Tre 25 », « 2 Ttre 2025 ».
    // Drapeau u : sans lui, « °? » ne rendrait optionnel que le 2e octet UTF-8 du « ° ».
    private const REGEX_TRIMESTRE = '/([1-4])(\s*°?\s*t?t?re\s*)(\d{2,4})/iu';

    /**
     * Copie du classeur PS09 pour une période (spec 006) : la dernière feuille
     * sert de gabarit, ses tableaux sont recalculés période par période, puis
     * elle est renommée et devient la seule feuille visible.
     *
     * @return array{sheet: string, places: list<array{libelle: string, cellule: string}>, non_places: list<string>}
     */
    private function genererCopie(string $templatePath, string $tempPath, int $annee, int $trimestre): array
    {
        $patcher = XlsxSurgicalPatcher::openCopy($templatePath, $tempPath);
        try {
            $feuilles = $patcher->listSheets();
            $gabarit = array_key_last($feuilles);
            $cible = 'E3 Rap Act '.self::MOIS_FEUILLE[$trimestre - 1].' '.$annee;

            $dom = $patcher->loadSheetDom($feuilles[$gabarit]);
            $resultat = $this->remplir($patcher, $dom, $annee, $trimestre);
            $patcher->saveSheetDom($feuilles[$gabarit], $dom);

            foreach (array_keys($feuilles) as $f) {
                if ($f !== $gabarit && trim($f) === $cible) {
                    $patcher->renameSheet($f, $cible.' (archive)');
                }
            }
            $patcher->renameSheet($gabarit, $cible);
            $patcher->showOnlySheet($cible);
            $patcher->forceFullRecalcOnLoad();
        } finally {
            $patcher->close();
        }

        return ['sheet' => $cible] + $resultat;
    }

    private const TITRES_COMMENTES = [
        'ia' => 'I.A', 'ib' => 'I.B', 'ic' => 'I.C', 'id' => 'I.D', 'ie' => 'I.E', 'if' => 'I.F', 'ig' => 'I.G',
        'iva' => 'IV.a', 'ivb' => 'IV.b', 'ivc' => 'IV.c', 'ivd' => 'IV.d',
    ];

    private const MOIS = [1 => 'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

    /**
     * Remplit la feuille gabarit. Chaque tableau garde son nombre de lignes ;
     * ses libellés glissent sur la période du rapport et chaque ligne reçoit
     * les données de SA période (research R2-R4). Priorité par cellule (FR-011) :
     * formations et employés → fichier pour la même période, sinon plateforme ;
     * saisies → saisie PS09, sinon fichier de la même période, sinon vide.
     */
    private function remplir(XlsxSurgicalPatcher $p, \DOMDocument $dom, int $annee, int $trimestre): array
    {
        $fin = $this->finTrimestre($annee, $trimestre);
        $saisies = RapportPs09::all()->keyBy(fn ($s) => $s->annee.'-'.$s->trimestre);
        $saisie = fn (int $a, int $t): array => $saisies->get("$a-$t")?->donnees ?? [];
        $t = $saisie($annee, $trimestre);
        $places = [];
        $nonPlaces = [];

        $depuisSaisie = function ($valeur, ?string $fichier, string $cellule, string $libelle) use (&$places) {
            if ($valeur === null) {
                return $this->nombre($fichier);
            }
            $places[] = ['libelle' => $libelle, 'cellule' => $cellule];

            return $valeur;
        };
        // Saisie du trimestre sans historique par période : écrite, sinon cellule vidée.
        $ecrire = function (?int $ligne, ?string $col, $valeur, string $libelle) use ($p, $dom, &$places, &$nonPlaces) {
            if ($ligne === null || $col === null) {
                if ($valeur !== null) {
                    $nonPlaces[] = $libelle;
                }

                return;
            }
            try {
                if ($valeur === null) {
                    $p->clearCell($dom, $col.$ligne);

                    return;
                }
                is_string($valeur) ? $p->setTextCell($dom, $col.$ligne, $valeur) : $p->setNumericCell($dom, $col.$ligne, $valeur);
                $places[] = ['libelle' => $libelle, 'cellule' => $col.$ligne];
            } catch (\RuntimeException) {
                $nonPlaces[] = $libelle; // ligne absente ou formule à cet emplacement
            }
        };

        if (is_numeric($p->cellValue($dom, 'F5'))) {
            $p->setNumericCell($dom, 'F5', $this->serieExcel($fin)); // date du rapport
        }

        foreach (self::TITRES_COMMENTES as $cle => $prefixe) {
            $titre = $p->findTitleRow($dom, $prefixe);
            $com = $titre ? $p->findRowInCol($dom, 'I', 'Commentaire', $titre) : null;
            $ecrire($com ? $com + 2 : null, 'I', $t['commentaires'][$cle] ?? null, "$prefixe — Commentaire");
        }

        $r = $p->findRowInCol($dom, 'B', "Nbre d'action :");
        $pa = $t['plan_action'] ?? [];
        $ecrire($r, 'E', $pa['actions'] ?? null, "Plan d'action — nombre d'actions");
        $ecrire($r ? $r + 1 : null, 'E', $pa['echues'] ?? null, "Plan d'action — actions échues");
        $ecrire($r ? $r + 2 : null, 'E', $pa['cloturees'] ?? null, "Plan d'action — actions clôturées");
        $ecrire($r, 'I', $pa['recommandation'] ?? null, "Plan d'action — recommandation");

        $this->remplirListeRecrutements($p, $dom, $fin);

        // Les tableaux sont sous le tableau formation : on y commence les recherches pour qu'un
        // mot du texte des sections (ex. « stagiaires » dans I.B) ne soit pas pris pour un tableau.
        $base = $p->findHeaderRow($dom, 'Nbre de Formation Planifi');
        $trimestres = fn (int $anneeFin) => fn (int $n) => $this->trimestres($anneeFin, $n);
        $annees = fn (int $anneeFin) => fn (int $n) => $this->annees($anneeFin, $n);

        if ($base !== null) {
            $formations = [];
            $formation = function (array $per, string $cle) use (&$formations) {
                $formations[$per['cle']] ??= $this->formationsPeriode($per['debut'], $per['fin']);

                return $formations[$per['cle']][$cle];
            };
            $colonnes = ['B' => fn ($per, $f) => $this->nombre($f)]; // formations non exprimées : fichier seulement
            foreach (['planifiees' => 'Nbre de Formation Planifi', 'realisees' => 'Nbre de Formations R', 'evaluees' => 'Nbre des Formations Eval', 'efficaces' => 'formations efficaces'] as $cle => $entete) {
                if ($col = $p->findColInRow($dom, $base, $entete)) {
                    $colonnes[$col] = fn ($per, $f) => $this->nombre($f) ?? $formation($per, $cle);
                }
            }
            if ($col = $p->findColInRowMatching($dom, $base, '/(^|\s)at$/')) {
                $colonnes[$col] = fn ($per, $f, $c) => $depuisSaisie($saisie($per['annee'], $per['t'])['accidents_travail'] ?? null, $f, $c, 'Accidents de travail — '.$per['nom']);
            }
            $this->remplirGrille($p, $dom, $base, 'C', $trimestres($annee), $colonnes, $fin);

            foreach (['Nomb Totale des formations', 'Nomb de formations à distance'] as $libelle) {
                if ($r = $p->findRowInCol($dom, 'B', $libelle, $base)) {
                    $this->ecrireLibelle($p, $dom, "B$r", $this->annees($annee, 1)[0]);
                }
            }
        } elseif (isset($t['accidents_travail'])) {
            $nonPlaces[] = "Accidents de travail — T$trimestre $annee";
        }
        $base ??= 1;

        $h = $p->findHeaderRow($dom, 'effectif int');
        if ($h !== null) {
            // Historique employé incomplet dans la plateforme : valeur du fichier pour une année
            // terminée avant la fin du rapport, sinon cumul plateforme jusqu'à la fin du trimestre.
            $employes = fn (array $per, ?string $f, string $cle) => ($per['fin']->lte($fin) ? $this->nombre($f) : null)
                ?? $this->employesPeriode($per['debut'], $per['fin']->min($fin))[$cle];
            $colonnes = [];
            foreach ([
                'besoins' => fn ($per, $f, $c) => $depuisSaisie($saisie($per['annee'], 0)['recrutement']['besoins'] ?? null, $f, $c, "Recrutement {$per['annee']} — besoins exprimés"),
                'recrutements satisf' => fn ($per, $f) => $employes($per, $f, 'integres'),
                'effectif int' => fn ($per, $f) => $employes($per, $f, 'integres'),
                'de d' => fn ($per, $f) => $employes($per, $f, 'departs'),
                'mutation' => fn ($per, $f) => $employes($per, $f, 'mutations'),
            ] as $entete => $valeur) {
                if ($col = $p->findColInRow($dom, $h, $entete)) {
                    $colonnes[$col] = $valeur;
                }
            }
            $this->remplirGrille($p, $dom, $h, $p->findColInRow($dom, $h, 'Ann') ?? 'B', $annees($annee + 1), $colonnes, $fin);
        }

        $h = $p->findRowInCol($dom, 'C', 'Nbre des réclamations reçus', $base);
        if ($h !== null) {
            $rec = fn ($per) => $saisie($per['annee'], $per['t'])['reclamations'] ?? [];
            $nonSatisfaites = fn ($per) => isset($rec($per)['recues'], $rec($per)['satisfaites']) ? $rec($per)['recues'] - $rec($per)['satisfaites'] : null;
            $this->remplirGrille($p, $dom, $h, 'B', $trimestres($annee), [
                'C' => fn ($per, $f, $c) => $depuisSaisie($rec($per)['recues'] ?? null, $f, $c, 'Réclamations reçues — '.$per['nom']),
                'D' => fn ($per, $f, $c) => $depuisSaisie($rec($per)['satisfaites'] ?? null, $f, $c, 'Réclamations satisfaites — '.$per['nom']),
                'E' => fn ($per, $f, $c) => $depuisSaisie($nonSatisfaites($per), $f, $c, 'Réclamations non satisfaites — '.$per['nom']),
                'H' => fn ($per, $f) => $f, // note du fichier (« Encours de traitement ») : suit sa période
            ], $fin);
        } elseif (isset($t['reclamations'])) {
            $nonPlaces[] = "Réclamations — T$trimestre $annee";
        }

        $titre = $p->findRowInCol($dom, 'B', 'SUIVI Engagements', $base);
        $h = $titre ? $p->findRowInCol($dom, 'B', 'Mois', $titre) : null;
        if ($h !== null) {
            $eng = fn ($per, string $cle) => $saisie($per['annee'], intdiv($per['mois'] - 1, 3) + 1)['engagements'][($per['mois'] - 1) % 3][$cle] ?? null;
            $libelle = fn ($per, string $quoi) => 'Engagements siège — '.self::MOIS[$per['mois']]." {$per['annee']} ($quoi)";
            $this->remplirGrille($p, $dom, $h, 'B', fn (int $n) => array_slice($this->moisDe($annee), -$n), [
                'C' => fn ($per, $f, $c) => $depuisSaisie($eng($per, 'prevu'), $f, $c, $libelle($per, 'prévu')),
                'D' => fn ($per, $f, $c) => $depuisSaisie($eng($per, 'realise'), $f, $c, $libelle($per, 'réalisé')),
            ], $fin);
            if ($h2 = $p->findRowInCol($dom, 'F', 'Trimestre', $h)) {
                $this->remplirGrille($p, $dom, $h2, 'F', $trimestres($annee), [], $fin);
            }
        } elseif (isset($t['engagements'])) {
            $nonPlaces[] = "Engagements siège — T$trimestre $annee";
        }

        $titre = $p->findRowInCol($dom, 'B', 'Gestion des Connaissances', $base);
        $h = $titre ? $p->findRowInCol($dom, 'D', 'Taux de polyvalence', $titre) : null;
        if ($h !== null) {
            $po = fn ($per) => $saisie($per['annee'], 0)['polyvalence'] ?? [];
            $this->remplirGrille($p, $dom, $h, 'B', $annees($annee), [
                'E' => fn ($per, $f, $c) => $depuisSaisie($po($per)['competences'] ?? null, $f, $c, "Polyvalence {$per['annee']} — compétences > 1"),
                'F' => fn ($per, $f, $c) => $depuisSaisie($po($per)['taches'] ?? null, $f, $c, "Polyvalence {$per['annee']} — nombre de tâches"),
            ], $fin);
        }

        $titre = $p->findRowInCol($dom, 'B', 'Stagiaires', $base);
        $h = $titre ? $p->findRowInCol($dom, 'B', 'Année', $titre) : null;
        if ($h !== null) {
            $st = fn ($per) => $saisie($per['annee'], 0)['stages'] ?? [];
            $this->remplirGrille($p, $dom, $h, 'B', $annees($annee), [
                'C' => fn ($per, $f, $c) => $depuisSaisie($st($per)['besoins'] ?? null, $f, $c, "Stages {$per['annee']} — besoins identifiés"),
                'D' => fn ($per, $f, $c) => $depuisSaisie($st($per)['stagiaires'] ?? null, $f, $c, "Stages {$per['annee']} — stagiaires accueillis"),
                'E' => fn ($per, $f, $c) => $depuisSaisie($st($per)['actions_amelioration'] ?? null, $f, $c, "Stages {$per['annee']} — actions d'amélioration"),
            ], $fin);
        }

        // Lignes « Satisfaction en Recrutement 2023 » : la 1re dont le libellé porte une année (pas le titre de section).
        $r = $p->findRowInCol($dom, 'B', 'Satisfaction en Recrutement', $base);
        while ($r !== null && $this->lirePeriode($p->cellValue($dom, "B$r")) === null) {
            $r = $p->findRowInCol($dom, 'B', 'Satisfaction en Recrutement', $r + 1);
        }
        if ($r !== null) {
            $this->remplirGrille($p, $dom, $r - 1, 'B', $annees($annee - 1), [], $fin);
        }

        if ($h = $p->findRowInCol($dom, 'G', 'Taux de contamination', $base)) {
            $fichier = fn ($per, $f) => $this->nombre($f); // aucune source plateforme
            $this->remplirGrille($p, $dom, $h, 'B', $trimestres($annee - 1), ['D' => $fichier, 'E' => $fichier], $fin);
        }

        // Exigence / effectif réel des contrôleurs et pompiers (photo à la génération).
        $a = $saisie($annee, 0);
        $postes = $this->postes();
        $h = $p->findRowInCol($dom, 'C', 'Contr', $base);
        $exigence = $h ? $p->findRowInCol($dom, 'B', 'Exigence', $h) : null;
        $nbre = $exigence ? $p->findRowInCol($dom, 'B', 'Nbre', $exigence + 1) : null;
        $nbre = $nbre !== null && $nbre <= $exigence + 3 ? $nbre : null;
        foreach (['controleurs' => ['Contr', 'Contrôleurs'], 'pompiers' => ['Pompier', 'Pompiers']] as $cle => [$entete, $libelle]) {
            $col = $h ? $p->findColInRow($dom, $h, $entete) : null;
            if (isset($a['exigences'][$cle])) {
                $ecrire($exigence, $col, $a['exigences'][$cle], "$libelle — exigence");
            }
            $ecrire($nbre, $col, $postes[$cle], "$libelle — effectif");
        }

        return ['places' => $places, 'non_places' => array_values(array_unique($nonPlaces))];
    }

    /**
     * Réécrit un tableau à grille fixe : index des valeurs du fichier par période
     * d'origine, nouveaux libellés, puis chaque colonne reçoit $colonnes[col]
     * (période, valeur du fichier pour CETTE période, cellule). Les périodes
     * postérieures au rapport sont vidées ; les formules ne sont jamais touchées.
     *
     * @param  callable(int): list<array>  $fenetre  N périodes, de la plus ancienne à la plus récente
     * @param  array<string, callable>  $colonnes
     */
    private function remplirGrille(XlsxSurgicalPatcher $p, \DOMDocument $dom, int $entete, string $colLibelle, callable $fenetre, array $colonnes, Carbon $fin): void
    {
        $lignes = $this->grille($p, $dom, $entete, $colLibelle);
        if ($lignes === []) {
            return;
        }

        $fichier = [];
        foreach ($lignes as $ligne => $cle) {
            foreach (array_keys($colonnes) as $col) {
                $fichier[$cle][$col] = $p->cellValue($dom, $col.$ligne);
            }
        }

        $periodes = $fenetre(count($lignes));
        foreach (array_keys($lignes) as $i => $ligne) {
            $per = $periodes[$i];
            $this->ecrireLibelle($p, $dom, $colLibelle.$ligne, $per);
            foreach ($colonnes as $col => $valeur) {
                $v = $per['debut']->gt($fin) ? null : $valeur($per, $fichier[$per['cle']][$col] ?? null, $col.$ligne);
                try {
                    if ($v === null) {
                        $p->clearCell($dom, $col.$ligne);
                    } else {
                        is_string($v) ? $p->setTextCell($dom, $col.$ligne, $v) : $p->setNumericCell($dom, $col.$ligne, $v);
                    }
                } catch (\RuntimeException) {
                    // formule à cet emplacement : conservée telle quelle
                }
            }
        }
    }

    /**
     * Lignes de données sous $entete : [ligne => clé de période du fichier].
     * S'arrête à la première ligne dont le libellé n'est pas une période (titre
     * de section suivant) ; tolère une ligne vide juste sous l'en-tête.
     *
     * @return array<int,string>
     */
    private function grille(XlsxSurgicalPatcher $p, \DOMDocument $dom, int $entete, string $col): array
    {
        $lignes = [];
        $videToleree = true;
        for ($r = $entete + 1; $r <= $entete + 40; $r++) {
            $libelle = $p->cellValue($dom, $col.$r);
            $cle = $this->lirePeriode($libelle);
            if ($cle === null) {
                if ($lignes === [] && $libelle === null && $videToleree) {
                    $videToleree = false;

                    continue;
                }
                break;
            }
            $lignes[$r] = $cle;
        }

        return $lignes;
    }

    /** Clé de période d'un libellé du classeur : « 2025-T3 », « 2025 » ou « 2025-07 » ; null sinon. */
    private function lirePeriode(?string $libelle): ?string
    {
        if ($libelle === null) {
            return null;
        }
        if (preg_match(self::REGEX_TRIMESTRE, $libelle, $m)) {
            $a = (int) $m[3];

            return ($a < 100 ? 2000 + $a : $a).'-T'.$m[1];
        }
        if (is_numeric($libelle)) {
            $n = (int) $libelle;
            if ($n >= 1990 && $n <= 2100) {
                return (string) $n;
            }

            // Date série Excel (mois du suivi des engagements).
            return $n > 20000 && $n < 80000 ? Carbon::create(1899, 12, 30)->addDays($n)->format('Y-m') : null;
        }

        return preg_match('/\b((?:19|20)\d{2})\s*$/', $libelle, $m) ? $m[1] : null;
    }

    /** Nouveau libellé dans le format de l'ancien (espaces, « ° », année sur 2 ou 4 chiffres). */
    private function ecrireLibelle(XlsxSurgicalPatcher $p, \DOMDocument $dom, string $cellule, array $per): void
    {
        $modele = (string) $p->cellValue($dom, $cellule);
        try {
            if ($per['mois'] !== null) {
                $p->setNumericCell($dom, $cellule, $this->serieExcel($per['debut']));
            } elseif ($per['t'] !== null) {
                $p->setTextCell($dom, $cellule, preg_replace_callback(self::REGEX_TRIMESTRE, fn ($m) => $per['t'].$m[2].(strlen($m[3]) === 4 ? $per['annee'] : sprintf('%02d', $per['annee'] % 100)), $modele, 1));
            } elseif (is_numeric($modele)) {
                $p->setNumericCell($dom, $cellule, $per['annee']);
            } else {
                $p->setTextCell($dom, $cellule, preg_replace('/\b(?:19|20)\d{2}(?=\D*$)/', (string) $per['annee'], $modele, 1));
            }
        } catch (\RuntimeException) {
            // libellé calculé par formule : conservé
        }
    }

    /** I.B : les N derniers recrutements (mois × poste) jusqu'à la fin du trimestre, comme la liste du fichier. */
    private function remplirListeRecrutements(XlsxSurgicalPatcher $p, \DOMDocument $dom, Carbon $fin): void
    {
        $titre = $p->findTitleRow($dom, 'I.B');
        $com = $titre ? $p->findRowInCol($dom, 'I', 'Commentaire', $titre) : null;
        if ($com === null || $com - 1 < $titre + 2) {
            return;
        }
        $lignes = range($titre + 2, $com - 1);

        $groupes = Employe::whereNotNull('date_embauche')->where('date_embauche', '<=', $fin)
            ->get(['date_embauche', 'fonction'])
            ->groupBy(fn ($e) => $e->date_embauche->format('Y-m').'|'.($e->fonction ?: 'poste non renseigné'))
            ->sortKeys()
            ->slice(-count($lignes))
            ->map(function ($groupe, $cle) {
                [$mois, $fonction] = explode('|', $cle, 2);
                [$a, $m] = array_map('intval', explode('-', $mois));

                return $groupe->count().'. Recrutement en '.ucfirst(self::MOIS[$m])." $a pour le poste de $fonction";
            })->values();

        foreach ($lignes as $i => $ligne) {
            try {
                isset($groupes[$i]) ? $p->setTextCell($dom, "B$ligne", $groupes[$i]) : $p->clearCell($dom, "B$ligne");
            } catch (\RuntimeException) {
                // ligne absente du gabarit
            }
        }
    }

    private function finTrimestre(int $annee, int $trimestre): Carbon
    {
        return Carbon::create($annee, $trimestre * 3, 1)->endOfMonth();
    }

    private function serieExcel(Carbon $date): int
    {
        return (int) (Carbon::create($date->year, $date->month, $date->day, 0, 0, 0, 'UTC')->timestamp / 86400) + 25569;
    }

    private function nombre(?string $valeur): int|float|null
    {
        return is_numeric($valeur) ? $valeur + 0 : null;
    }

    private function periode(Carbon $debut, Carbon $fin, int $annee, ?int $t, ?int $mois, string $cle, string $nom): array
    {
        return compact('debut', 'fin', 'annee', 't', 'mois', 'cle', 'nom');
    }

    /** Les $n trimestres finissant au T4 de $anneeFin, du plus ancien au plus récent. */
    private function trimestres(int $anneeFin, int $n): array
    {
        $liste = [];
        for ($i = $n - 1; $i >= 0; $i--) {
            $index = $anneeFin * 4 + 3 - $i;
            [$a, $t] = [intdiv($index, 4), $index % 4 + 1];
            $debut = Carbon::create($a, ($t - 1) * 3 + 1, 1)->startOfDay();
            $liste[] = $this->periode($debut, $debut->copy()->addMonths(2)->endOfMonth(), $a, $t, null, "$a-T$t", "T$t $a");
        }

        return $liste;
    }

    /** Les $n années finissant à $anneeFin. */
    private function annees(int $anneeFin, int $n): array
    {
        return array_map(
            fn ($a) => $this->periode(Carbon::create($a, 1, 1)->startOfDay(), Carbon::create($a, 12, 31)->endOfDay(), $a, null, null, (string) $a, (string) $a),
            range($anneeFin - $n + 1, $anneeFin)
        );
    }

    private function moisDe(int $annee): array
    {
        return array_map(function ($m) use ($annee) {
            $debut = Carbon::create($annee, $m, 1)->startOfDay();

            return $this->periode($debut, $debut->copy()->endOfMonth(), $annee, null, $m, $debut->format('Y-m'), self::MOIS[$m]." $annee");
        }, range(1, 12));
    }

    /** @return array{planifiees: int, realisees: int, evaluees: int, efficaces: int} */
    private function formationsPeriode(Carbon $debut, Carbon $fin): array
    {
        $q = Formation::whereBetween('date_debut', [$debut, $fin]);

        return [
            'planifiees' => (clone $q)->count(),
            'realisees' => (clone $q)->whereDate('date_fin', '<', now())->count(),
            'evaluees' => (clone $q)->whereHas('evaluations')->count(),
            'efficaces' => (clone $q)->whereHas('evaluations', fn ($e) => $e->where('efficace', true))->count(),
        ];
    }

    /** @return array{integres: int, departs: int, mutations: int} */
    private function employesPeriode(Carbon $debut, Carbon $fin): array
    {
        $entre = [$debut->copy()->startOfDay(), $fin->copy()->endOfDay()];
        $departScope = fn ($q) => $q
            ->where(fn ($q2) => $q2->where('retraite', true)->whereBetween('date_retraite', $entre))
            ->orWhere(fn ($q2) => $q2->where('depart_volontaire', true)->whereBetween('date_depart_volontaire', $entre));

        return [
            'integres' => Employe::whereBetween('date_embauche', $entre)->count(),
            'departs' => Employe::where($departScope)->count(),
            // Un employé ayant plusieurs statuts de sortie (ex. retraite + mutation)
            // ne doit être compté que comme un départ, pas comme une mutation en plus.
            'mutations' => Employe::where('mutation', true)->whereBetween('date_mutation', $entre)->whereNot($departScope)->count(),
        ];
    }

    /** @return array{controleurs: int, pompiers: int} */
    private function postes(): array
    {
        return [
            'controleurs' => Employe::whereIn('statut', ['actif', 'mute'])->where('fonction', 'like', 'contr%')->count(),
            'pompiers' => Employe::whereIn('statut', ['actif', 'mute'])->where('fonction', 'like', 'pompier%')->count(),
        ];
    }

    private function computeStats(int $annee, int $trimestre): array
    {
        $debut = Carbon::createFromDate($annee, ($trimestre - 1) * 3 + 1, 1)->startOfDay();
        $fin = $debut->copy()->addMonths(2)->endOfMonth();
        // Chiffres annuels arrêtés à la fin du trimestre : un rapport T1 ne compte pas une embauche d'août.
        $debutAnnee = Carbon::create($annee, 1, 1)->startOfDay();

        return [
            'annee' => $annee,
            'trimestre' => $trimestre,
            'periode' => ['debut' => $debut->toDateString(), 'fin' => $fin->toDateString()],
            'formation' => $this->formationsPeriode($debut, $fin),
            'effectif' => $this->employesPeriode($debutAnnee, $fin),
            // Données du fichier PS09 calculables depuis les employés (spec 005, FR-014).
            'recrutements' => Employe::whereBetween('date_embauche', [$debutAnnee, $fin])
                ->get(['date_embauche', 'fonction'])
                ->groupBy(fn ($e) => $e->date_embauche->format('Y-m').'|'.($e->fonction ?: 'poste non renseigné'))
                ->sortKeys()
                ->map(fn ($groupe, $cle) => [
                    'mois' => (int) substr($cle, 5, 2),
                    'fonction' => explode('|', $cle, 2)[1],
                    'nombre' => $groupe->count(),
                ])->values(),
            'postes' => $this->postes(),
        ];
    }
}
