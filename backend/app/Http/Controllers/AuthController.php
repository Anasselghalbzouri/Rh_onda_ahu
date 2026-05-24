<?php

namespace App\Http\Controllers;

use App\Models\ResponsableRh;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'matricule' => 'required|string',
            'password'  => 'required|string',
        ]);

        $rh = ResponsableRh::with('employe')->where('login', $request->input('matricule'))->first();

        if (! $rh || ! Hash::check($request->input('password'), $rh->password)) {
            throw ValidationException::withMessages([
                'matricule' => ['Matricule ou mot de passe incorrect.'],
            ]);
        }

        $token = $rh->createToken('api-token')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user'  => [
                'id'        => $rh->id,
                'matricule' => $rh->login,
                'prenom'    => $rh->employe?->prenom,
                'nom'       => $rh->employe?->nom,
                'role'      => 'rh',
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Déconnexion réussie.']);
    }

    public function me(Request $request): JsonResponse
    {
        $rh = $request->user()->load('employe');

        return response()->json([
            'id'        => $rh->id,
            'matricule' => $rh->login,
            'prenom'    => $rh->employe?->prenom,
            'nom'       => $rh->employe?->nom,
            'role'      => 'rh',
        ]);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $request->validate([
            'current_password'      => 'required|string',
            'password'              => 'required|string|min:4|confirmed',
            'password_confirmation' => 'required|string',
        ]);

        $rh = $request->user();

        if (! Hash::check($request->input('current_password'), $rh->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Mot de passe actuel incorrect 😒ok '],
            ]);
        }

        $rh->update(['password' => Hash::make($request->input('password'))]);

        return response()->json(['message' => 'Mot de passe mis à jour avec succès.']);
    }
}
