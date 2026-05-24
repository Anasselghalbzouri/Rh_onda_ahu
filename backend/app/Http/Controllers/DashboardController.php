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

        // ── KPIs ──
        $totalEmployes = Employe::where('statut','!=','retraite')->count();
        $congesEnCours = DemandeConge::where('date_debut', '<=', $fin)
            ->where('date_fin', '>=', $debut)->count();
        $congesCeMois  = DemandeConge::where('date_debut', '<=', $fin)
            ->where('date_fin', '>=', $debut)->count();
        $soldeMoyen    = round((float) Employe::avg('solde_conge'), 1);

        // ── Congés par type ──
        $parType = DemandeConge::select('type_conge', DB::raw('COUNT(*) as total'))
            ->groupBy('type_conge')->orderByDesc('total')->get()
            ->map(fn($r) => ['type' => $r->type_conge, 'total' => $r->total]);

        // ── Tendance 6 mois ──
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

        // ── Répartition par sexe ──
        $parSexe = Employe::select('sexe', DB::raw('COUNT(*) as total'))
            ->whereNotNull('sexe')
            ->groupBy('sexe')->get()
            ->map(fn($r) => ['sexe' => strtoupper($r->sexe), 'total' => $r->total]);

        // ── Répartition par statut ──
        $parStatut = Employe::select('statut', DB::raw('COUNT(*) as total'))
            ->whereNotNull('statut')
            ->groupBy('statut')->orderByDesc('total')->get()
            ->map(fn($r) => ['statut' => $r->statut, 'total' => $r->total]);

        // ── Top 8 fonctions ──
        $parFonction = Employe::select('fonction', DB::raw('COUNT(*) as total'))
            ->whereNotNull('fonction')->where('fonction', '!=', '')
            ->groupBy('fonction')->orderByDesc('total')->limit(8)->get()
            ->map(fn($r) => ['fonction' => $r->fonction, 'total' => $r->total]);

        // ── Top 8 services ──
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
            'par_type'        => $parType,
            'tendance'        => $tendance,
            'par_sexe'        => $parSexe,
            'par_statut'      => $parStatut,
            'par_fonction'    => $parFonction,
            'par_service'     => $parService,
        ]);
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
            ->where('statut', 'terminee')->count();

        $tauxCompletion = $total > 0 ? round(($terminees / $total) * 100, 1) : 0;

        $repartitionType = Formation::whereYear('date_debut', $annee)
            ->select('type', DB::raw('COUNT(*) as total'))
            ->groupBy('type')
            ->get()
            ->map(fn($r) => ['type' => $r->type, 'total' => $r->total]);

        return response()->json([
            'annee'              => $annee,
            'total_formations'   => $total,
            'nb_employes_formes' => $nbEmployesFormes,
            'budget_prevu'       => (float) $budgetPrevu,
            'taux_completion'    => $tauxCompletion,
            'repartition_type'   => $repartitionType,
        ]);
    }
}
