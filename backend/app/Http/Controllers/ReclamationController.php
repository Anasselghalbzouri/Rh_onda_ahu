<?php

namespace App\Http\Controllers;

use App\Exports\ReclamationExport;
use App\Models\Employe;
use App\Models\Reclamation;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReclamationController extends Controller
{
    private const REPONSE_INCOMPLETE = 'Saisissez la date et le contenu de la réponse.';

    private const MESSAGES = [
        'before_or_equal' => 'La date ne peut pas être dans le futur.',
        'employe_id.required' => 'Choisissez un employé.',
        'employe_id.exists' => 'Employé introuvable.',
        'date_reception.required' => 'La date de réception est obligatoire.',
        'date_reception.date' => 'La date de réception est invalide.',
        'type.required' => 'Le type de réclamation est obligatoire.',
        'type.max' => 'Le type de réclamation ne peut pas dépasser 255 caractères.',
        'description.required' => 'La description est obligatoire.',
        'description.max' => 'La description ne peut pas dépasser 5000 caractères.',
        'canal.required' => 'Le canal est obligatoire.',
        'canal.max' => 'Le canal ne peut pas dépasser 255 caractères.',
        'etat.required' => "L'état de la réclamation est obligatoire.",
        'etat.in' => 'État de réclamation inconnu.',
        'remarques.max' => 'Les remarques ne peuvent pas dépasser 2000 caractères.',
        'date_reponse_1.date' => 'La date de 1ère réponse est invalide.',
        'date_reponse_1.after_or_equal' => 'La date de 1ère réponse ne peut pas précéder la date de réception.',
        'date_reponse_1.required_with' => self::REPONSE_INCOMPLETE,
        'contenu_reponse_1.required_with' => self::REPONSE_INCOMPLETE,
        'contenu_reponse_1.max' => 'La réponse ne peut pas dépasser 5000 caractères.',
        'date_reponse_2.date' => 'La date de 2ème réponse est invalide.',
        'date_reponse_2.prohibited_if' => 'La 2ème réponse exige une 1ère réponse.',
        'date_reponse_2.after_or_equal' => 'La date de 2ème réponse ne peut pas précéder celle de la 1ère réponse.',
        'date_reponse_2.required_with' => self::REPONSE_INCOMPLETE,
        'contenu_reponse_2.required_with' => self::REPONSE_INCOMPLETE,
        'contenu_reponse_2.max' => 'La réponse ne peut pas dépasser 5000 caractères.',
        'date_solution.date' => 'La date de solution est invalide.',
        'date_solution.after_or_equal' => 'La date de solution ne peut pas précéder la date de réception.',
        'date_solution.required_if' => 'La date de solution est obligatoire pour une réclamation résolue ou rejetée.',
        'date_solution.prohibited_unless' => "La date de solution n'est permise que pour une réclamation résolue ou rejetée.",
    ];

    public function index(Request $request): JsonResponse
    {
        abort_if($this->estRole($request, 'employe'), 403, 'Action non autorisée pour ce rôle.');

        $page = $this->filtrees($request)
            ->orderByDesc('date_reception')
            ->orderByDesc('id')
            ->paginate(min((int) $request->query('per_page', 15), 200));

        return response()->json(array_merge($page->toArray(), [
            'options' => [
                'etats' => array_map(
                    fn (string $key, string $label) => ['key' => $key, 'label' => $label],
                    array_keys(Reclamation::ETATS),
                    Reclamation::ETATS,
                ),
            ],
        ]));
    }

    public function export(Request $request): StreamedResponse
    {
        abort_if($this->estRole($request, 'employe'), 403, 'Action non autorisée pour ce rôle.');

        return (new ReclamationExport($this->filtrees($request)))
            ->download('Tableau_suivi_reclamations_'.now()->format('Y-m-d').'.xlsx');
    }

    /** Requête partagée par index() et export() pour coller à ce que l'utilisateur voit. */
    private function filtrees(Request $request): Builder
    {
        $query = Reclamation::query();

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('numero', 'like', "%{$search}%")
                    ->orWhere('matricule', 'like', "%{$search}%")
                    ->orWhere('nom_complet', 'like', "%{$search}%")
                    ->orWhere('type', 'like', "%{$search}%");
            });
        }

        if ($etat = $request->query('etat')) {
            $query->where('etat', $etat);
        }

        return $query;
    }

    public function store(Request $request): JsonResponse
    {
        $this->refuserLecteurs($request);

        $data = $request->validate([
            'employe_id' => 'required|integer|exists:employe,id',
            ...$this->reglesCommunes(),
        ], self::MESSAGES);

        $employe = Employe::findOrFail($data['employe_id']);
        unset($data['employe_id']);

        $reclamation = DB::transaction(function () use ($data, $employe) {
            $annee = Carbon::parse($data['date_reception'])->year;

            $compteur = DB::table('reclamation_compteur')->where('annee', $annee);
            DB::table('reclamation_compteur')->insertOrIgnore(['annee' => $annee, 'dernier' => 0]);
            $compteur->increment('dernier');

            return Reclamation::create($data + [
                'numero' => sprintf('%03d/%d', $compteur->value('dernier'), $annee),
                'matricule' => $employe->matricule,
                'nom_complet' => "{$employe->nom} {$employe->prenom}",
                'etat' => 'nouvelle',
            ]);
        });

        return response()->json($reclamation->fresh(), 201);
    }

    public function update(Request $request, $id): JsonResponse
    {
        $this->refuserLecteurs($request);

        $reclamation = Reclamation::findOrFail($id);

        $data = $request->validate([
            ...$this->reglesCommunes(),
            'etat' => ['required', Rule::in(array_keys(Reclamation::ETATS))],
            'date_reponse_1' => 'nullable|date|after_or_equal:date_reception|before_or_equal:today|required_with:contenu_reponse_1',
            'contenu_reponse_1' => 'nullable|string|max:5000|required_with:date_reponse_1',
            'date_reponse_2' => 'nullable|date|prohibited_if:date_reponse_1,null|after_or_equal:date_reponse_1|before_or_equal:today|required_with:contenu_reponse_2',
            'contenu_reponse_2' => 'nullable|string|max:5000|required_with:date_reponse_2',
            'date_solution' => 'nullable|date|after_or_equal:date_reception|before_or_equal:today|required_if:etat,resolue,rejetee|prohibited_unless:etat,resolue,rejetee',
        ], self::MESSAGES);

        // Le numéro contient l'année de réception et n'est pas modifiable.
        if (Carbon::parse($data['date_reception'])->format('Y') !== Str::afterLast($reclamation->numero, '/')) {
            throw ValidationException::withMessages([
                'date_reception' => "L'année de réception doit rester celle du numéro. Supprimez et recréez la réclamation si elle est fausse.",
            ]);
        }

        $reclamation->update($data);

        return response()->json($reclamation->fresh());
    }

    public function destroy(Request $request, $id): JsonResponse
    {
        $this->refuserLecteurs($request);

        Reclamation::findOrFail($id)->delete();

        return response()->json(['message' => 'Réclamation supprimée.']);
    }

    /** @return array<string, mixed> */
    private function reglesCommunes(): array
    {
        return [
            'date_reception' => 'required|date|before_or_equal:today',
            'type' => 'required|string|max:255',
            'description' => 'required|string|max:5000',
            'canal' => 'required|string|max:255',
            'remarques' => 'nullable|string|max:2000',
        ];
    }

    private function refuserLecteurs(Request $request): void
    {
        abort_if($this->estRole($request, 'dg') || $this->estRole($request, 'employe'), 403, 'Action non autorisée pour ce rôle.');
    }
}
