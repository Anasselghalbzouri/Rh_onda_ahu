<?php

namespace App\Http\Controllers;

use App\Models\Employe;
use App\Models\PieceJointe;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class PieceJointeController extends Controller
{
    public function index($employe_id): JsonResponse
    {
        Employe::findOrFail($employe_id);

        $pieces = PieceJointe::pourEntite('employe', $employe_id)
            ->orderByDesc('date_upload')
            ->get()
            ->map(fn($p) => $this->format($p));

        return response()->json($pieces);
    }

    public function store(Request $request, $employe_id): JsonResponse
    {
        Employe::findOrFail($employe_id);

        $request->validate([
            'fichier'    => 'required|file|max:5120|mimes:pdf,jpg,jpeg,png,doc,docx',
            'categorie'  => 'nullable|string|max:100',
            'description'=> 'nullable|string|max:255',
        ]);

        $file        = $request->file('fichier');
        $chemin      = $file->store("pieces_jointes/{$employe_id}", 'public');
        $rh          = $request->user();

        $piece = PieceJointe::create([
            'entite'        => 'employe',
            'entite_id'     => $employe_id,
            'nom_original'  => $file->getClientOriginalName(),
            'nom_stockage'  => basename($chemin),
            'chemin'        => $chemin,
            'extension'     => strtolower($file->getClientOriginalExtension()),
            'taille_octets' => $file->getSize(),
            'mime_type'     => $file->getMimeType(),
            'categorie'     => $request->input('categorie'),
            'description'   => $request->input('description'),
            'uploade_par'   => $rh?->id,
            'date_upload'   => now(),
            'actif'         => true,
        ]);

        return response()->json($this->format($piece), 201);
    }

    public function destroy($id): JsonResponse
    {
        $piece = PieceJointe::where('actif', true)->findOrFail($id);

        Storage::disk('public')->delete($piece->chemin);

        $piece->update(['actif' => false]);

        return response()->json(['message' => 'Pièce jointe supprimée.']);
    }

    private function format(PieceJointe $p): array
    {
        return [
            'id'           => $p->id,
            'nom_original' => $p->nom_original,
            'extension'    => $p->extension,
            'taille'       => $p->taille_humaine,
            'categorie'    => $p->categorie,
            'description'  => $p->description,
            'date_upload'  => $p->date_upload?->format('d/m/Y H:i'),
            'url'          => $p->url,
        ];
    }
}
