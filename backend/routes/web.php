<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
 | Le frontend React est livré compilé dans public/ (build Vite) pour la
 | version « portable » servie par un seul processus PHP. On sert alors
 | public/index.html pour toutes les routes non-API (le routing se fait
 | côté client via react-router).
 |
 | En développement le build n'existe pas dans public/ : on retombe donc
 | sur la page Laravel par défaut, et c'est Vite qui sert le SPA.
 */
$serveSpa = function () {
    $index = public_path('index.html');

    return file_exists($index)
        ? response()->file($index)
        : view('welcome');
};

Route::get('/', $serveSpa);

Route::fallback(function (Request $request) use ($serveSpa) {
    // Ne jamais transformer un 404 d'API en page HTML.
    if ($request->is('api/*')) {
        abort(404);
    }

    return $serveSpa();
});
