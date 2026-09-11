<?php

namespace App\Http\Controllers;

use App\Models\Employe;
use App\Models\PieceJointe;
use App\Services\DocumentsEmployesService;
use App\Support\DocumentsEmployesReference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PieceJointeController extends Controller
{
    public function __construct(private readonly DocumentsEmployesService $documentsEmployes) {}

    public function index(Request $request, $employe_id): JsonResponse
    {
        Employe::findOrFail($employe_id);

        if ($this->estRole($request, 'employe')) {
            $employe = $request->user()->employe;

            abort_if(! $employe || (int) $employe->id !== (int) $employe_id, 403, 'Vous ne pouvez pas accéder à ces documents.');
        }

        $pieces = PieceJointe::pourEntite('employe', $employe_id)
            ->orderByDesc('date_upload')
            ->get()
            ->map(fn ($p) => $this->format($p));

        return response()->json($pieces);
    }

    public function indexGlobal(Request $request): JsonResponse
    {
        $lignes = $this->documentsEmployes->listeGlobale(
            $request->query('q'),
            $request->query('categorie'),
            $request->query('statut'),
        );

        $page = max(1, (int) $request->query('page', 1));
        $perPage = 20;

        return response()->json([
            'data' => array_slice($lignes, ($page - 1) * $perPage, $perPage),
            'meta' => [
                'total' => count($lignes),
                'page' => $page,
            ],
        ]);
    }

    public function mesPieces(Request $request): JsonResponse
    {
        // L'identifiant est toujours résolu depuis l'utilisateur authentifié,
        // jamais transmis par le client (FR-010).
        $employe = $request->user()->employe;

        abort_if(! $employe, 404, 'Aucun employé associé à ce compte.');

        return $this->index($request, $employe->id);
    }

    public function store(Request $request, $employe_id): JsonResponse
    {
        abort_if($this->estRole($request, 'dg') || $this->estRole($request, 'employe'), 403, 'Action non autorisée pour ce rôle.');

        Employe::findOrFail($employe_id);

        $request->validate([
            'fichier' => 'required|file|max:5120|mimes:pdf,jpg,jpeg,png,doc,docx',
            'categorie' => ['nullable', 'string', 'max:100', 'in:'.implode(',', DocumentsEmployesReference::CATEGORIES)],
            'description' => 'nullable|string|max:255',
            'date_expiration' => 'nullable|date',
            'obligatoire' => 'nullable|boolean',
        ]);

        $file = $request->file('fichier');
        $chemin = $file->store("pieces_jointes/{$employe_id}", 'local');
        $rh = $request->user();

        $piece = PieceJointe::create([
            'entite' => 'employe',
            'entite_id' => $employe_id,
            'nom_original' => $file->getClientOriginalName(),
            'nom_stockage' => basename($chemin),
            'chemin' => $chemin,
            'extension' => strtolower($file->getClientOriginalExtension()),
            'taille_octets' => $file->getSize(),
            'mime_type' => $file->getMimeType(),
            'categorie' => $request->input('categorie'),
            'description' => $request->input('description'),
            'date_expiration' => $request->input('date_expiration'),
            'obligatoire' => $request->boolean('obligatoire'),
            'uploade_par' => $rh?->id,
            'date_upload' => now(),
            'actif' => true,
        ]);

        return response()->json($this->format($piece), 201);
    }

    public function download(Request $request, $id): StreamedResponse
    {
        $piece = PieceJointe::where('actif', true)->findOrFail($id);

        if ($this->estRole($request, 'employe')) {
            $employe = $request->user()->employe;

            abort_if(
                ! $employe || $piece->entite !== 'employe' || (int) $piece->entite_id !== (int) $employe->id,
                403,
                'Vous ne pouvez pas accéder à ce document.'
            );
        }

        abort_if(! $piece->chemin || ! Storage::disk('local')->exists($piece->chemin), 404, 'Fichier introuvable.');

        return Storage::disk('local')->download($piece->chemin, $piece->nom_original);
    }

    public function destroy(Request $request, $id): JsonResponse
    {
        abort_if($this->estRole($request, 'dg') || $this->estRole($request, 'employe'), 403, 'Action non autorisée pour ce rôle.');

        $piece = PieceJointe::where('actif', true)->findOrFail($id);

        Storage::disk('local')->delete($piece->chemin);

        $piece->update([
            'actif' => false,
            'supprime_par' => $request->user()?->id,
        ]);

        return response()->json(['message' => 'Pièce jointe supprimée.']);
    }

    /**
     * Rôle de l'utilisateur authentifié. Aujourd'hui seul le guard RH existe ;
     * cette lecture reste compatible avec un futur attribut de rôle (Employé/DG).
     */
    private function estRole(Request $request, string $role): bool
    {
        return ($request->user()?->role ?? 'rh') === $role;
    }

    private function format(PieceJointe $p): array
    {
        return [
            'id' => $p->id,
            'nom_original' => $p->nom_original,
            'extension' => $p->extension,
            'taille' => $p->taille_humaine,
            'categorie' => $p->categorie,
            'description' => $p->description,
            'date_upload' => $p->date_upload?->format('d/m/Y H:i'),
            'date_expiration' => $p->date_expiration?->format('Y-m-d'),
            'statut' => $p->statutCalcule(),
            'obligatoire' => $p->obligatoire,
        ];
    }
}
