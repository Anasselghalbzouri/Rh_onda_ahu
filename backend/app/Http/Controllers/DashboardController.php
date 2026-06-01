<?php

namespace App\Http\Controllers;

use App\Models\DemandeConge;
use App\Models\Employe;
use App\Models\Formation;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function stats(): JsonResponse
    {
        $period = request()->query('period', 'month');
        $today  = now()->toDateString();

        [$debut, $fin] = match ($period) {
            'today' => [$today, $today],
            'week'  => [now()->startOfWeek()->toDateString(), now()->endOfWeek()->toDateString()],
            'year'  => [now()->startOfYear()->toDateString(), now()->endOfYear()->toDateString()],
            default => [now()->startOfMonth()->toDateString(), now()->endOfMonth()->toDateString()],
        };

        $totalEmployes = Employe::where('statut', 'actif')->count();
        $congesEnCours = DemandeConge::where('date_debut', '<=', $fin)
            ->where('date_fin', '>=', $debut)->count();
        $congesCeMois  = DemandeConge::where('date_debut', '<=', $fin)
            ->where('date_fin', '>=', $debut)->count();
        $soldeMoyen    = round((float) Employe::avg('solde_conge'), 1);
        $ageMoyen      = round((float) Employe::where('statut', '!=', 'retraite')
            ->whereNotNull('date_naissance')
            ->selectRaw('AVG(TIMESTAMPDIFF(YEAR, date_naissance, CURDATE())) as age_moyen')
            ->value('age_moyen'), 1);

        $parType = DemandeConge::select('type_conge', DB::raw('COUNT(*) as total'))
            ->groupBy('type_conge')->orderByDesc('total')->get()
            ->map(fn($r) => ['type' => $r->type_conge, 'total' => $r->total]);

        $tendance = collect();
        for ($i = 5; $i >= 0; $i--) {
            $m     = now()->subMonths($i);
            $debut = $m->copy()->startOfMonth()->toDateString();
            $fin   = $m->copy()->endOfMonth()->toDateString();
            $tendance->push([
                'mois'  => $m->locale('fr')->isoFormat('MMM YY'),
                'total' => DemandeConge::where('date_debut', '<=', $fin)
                    ->where('date_fin', '>=', $debut)->count(),
            ]);
        }

        $parSexe = Employe::select('sexe', DB::raw('COUNT(*) as total'))
            ->where('statut', 'actif')
            ->whereNotNull('sexe')
            ->groupBy('sexe')->get()
            ->map(fn($r) => ['sexe' => strtoupper($r->sexe), 'total' => $r->total]);

        $parStatut = Employe::select('statut', DB::raw('COUNT(*) as total'))
            ->whereNotNull('statut')
            ->groupBy('statut')->orderByDesc('total')->get()
            ->map(fn($r) => ['statut' => $r->statut, 'total' => $r->total]);

        $parFonction = Employe::select('fonction', DB::raw('COUNT(*) as total'))
            ->whereNotNull('fonction')->where('fonction', '!=', '')
            ->groupBy('fonction')->orderByDesc('total')->limit(8)->get()
            ->map(fn($r) => ['fonction' => $r->fonction, 'total' => $r->total]);

        $parService = Employe::select('service.nom as service', DB::raw('COUNT(employe.id) as total'))
            ->join('service', 'employe.service_id', '=', 'service.id')
            ->groupBy('service.id', 'service.nom')
            ->orderByDesc('total')->limit(8)->get()
            ->map(fn($r) => ['service' => $r->service, 'total' => $r->total]);

        return response()->json([
            'total_employes'  => $totalEmployes,
            'conges_en_cours' => $congesEnCours,
            'conges_ce_mois'  => $congesCeMois,
            'solde_moyen'     => $soldeMoyen,
            'age_moyen'       => $ageMoyen,
            'par_type'        => $parType,
            'tendance'        => $tendance,
            'par_sexe'        => $parSexe,
            'par_statut'      => $parStatut,
            'par_fonction'    => $parFonction,
            'par_service'     => $parService,
        ]);
    }

    public function pyramideAges(): JsonResponse
    {
        $tranches = [
            ['label' => '20-24', 'min' => 20, 'max' => 24],
            ['label' => '25-29', 'min' => 25, 'max' => 29],
            ['label' => '30-34', 'min' => 30, 'max' => 34],
            ['label' => '35-39', 'min' => 35, 'max' => 39],
            ['label' => '40-44', 'min' => 40, 'max' => 44],
            ['label' => '45-49', 'min' => 45, 'max' => 49],
            ['label' => '50-54', 'min' => 50, 'max' => 54],
            ['label' => '55-59', 'min' => 55, 'max' => 59],
            ['label' => '60+',   'min' => 60, 'max' => 100],
        ];

        $data = [];
        foreach ($tranches as $t) {
            $bornMax = now()->subYears($t['min'])->toDateString();
            $bornMin = now()->subYears($t['max'] + 1)->addDay()->toDateString();
            $data[] = [
                'tranche' => $t['label'],
                'hommes'  => Employe::where('statut', '!=', 'retraite')->where('sexe', 'M')
                    ->whereNotNull('date_naissance')->whereBetween('date_naissance', [$bornMin, $bornMax])->count(),
                'femmes'  => Employe::where('statut', '!=', 'retraite')->where('sexe', 'F')
                    ->whereNotNull('date_naissance')->whereBetween('date_naissance', [$bornMin, $bornMax])->count(),
            ];
        }

        return response()->json($data);
    }

    public function anciennete(): JsonResponse
    {
        $tranches = [
            ['label' => '< 5 ans',   'min' => 0,  'max' => 4],
            ['label' => '5-9 ans',   'min' => 5,  'max' => 9],
            ['label' => '10-14 ans', 'min' => 10, 'max' => 14],
            ['label' => '15-19 ans', 'min' => 15, 'max' => 19],
            ['label' => '20-24 ans', 'min' => 20, 'max' => 24],
            ['label' => '25-29 ans', 'min' => 25, 'max' => 29],
            ['label' => '>= 30 ans', 'min' => 30, 'max' => 99],
        ];

        $data = [];
        foreach ($tranches as $t) {
            $dateMax = now()->subYears($t['min'])->toDateString();
            $dateMin = now()->subYears($t['max'] + 1)->addDay()->toDateString();
            $data[] = [
                'tranche' => $t['label'],
                'total'   => Employe::where('statut', '!=', 'retraite')->whereNotNull('date_embauche')
                    ->whereBetween('date_embauche', [$dateMin, $dateMax])->count(),
            ];
        }

        return response()->json($data);
    }

    public function formationsStats(): JsonResponse
    {
        $annee = now()->year;

        $total = Formation::whereYear('date_debut', $annee)->count();

        $nbEmployesFormes = DB::table('employe_formation')
            ->join('formation', 'formation.id', '=', 'employe_formation.formation_id')
            ->whereYear('formation.date_debut', $annee)
            ->distinct('employe_formation.employe_id')
            ->count('employe_formation.employe_id');

        $budgetPrevu = 0;

        $terminees = Formation::whereYear('date_debut', $annee)
            ->whereDate('date_fin', '<', now()->toDateString())->count();

        $tauxCompletion = $total > 0 ? round(($terminees / $total) * 100, 1) : 0;

        $repartitionType = Formation::whereYear('date_debut', $annee)
            ->select('type', DB::raw('COUNT(*) as total'))
            ->groupBy('type')
            ->get()
            ->map(fn($r) => ['type' => $r->type, 'total' => $r->total]);

        $repartitionService = DB::table('employe_formation')
            ->join('formation', 'formation.id', '=', 'employe_formation.formation_id')
            ->join('employe', 'employe.id', '=', 'employe_formation.employe_id')
            ->join('service', 'service.id', '=', 'employe.service_id')
            ->whereYear('formation.date_debut', $annee)
            ->select('service.nom as service', DB::raw('COUNT(DISTINCT employe_formation.employe_id) as total'))
            ->groupBy('service.id', 'service.nom')
            ->orderByDesc('total')
            ->limit(8)
            ->get()
            ->map(fn($r) => ['service' => $r->service, 'total' => $r->total]);

        return response()->json([
            'annee'               => $annee,
            'total_formations'    => $total,
            'nb_employes_formes'  => $nbEmployesFormes,
            'taux_completion'     => $tauxCompletion,
            'repartition_type'    => $repartitionType,
            'repartition_service' => $repartitionService,
        ]);
    }
}
