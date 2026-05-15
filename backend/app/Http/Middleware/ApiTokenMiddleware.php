<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ApiTokenMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        if (! $token || $token !== config('app.excel_sync_token')) {
            return response()->json(['error' => 'Token invalide ou manquant.'], 401);
        }

        return $next($request);
    }
}
