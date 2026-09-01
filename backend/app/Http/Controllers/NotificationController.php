<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use Illuminate\Http\JsonResponse;

class NotificationController extends Controller
{
    /**
     * Liste les notifications récentes + le nombre de non-lues.
     *
     * L'état "lu" est global (partagé par l'équipe RH) : simplification assumée
     * pour des événements système (synchro Excel) plutôt que des alertes
     * personnelles. Pour un état par utilisateur, ajouter une colonne user_id.
     */
    public function index(): JsonResponse
    {
        $notifications = Notification::orderByDesc('id')->limit(30)->get();

        return response()->json([
            'notifications' => $notifications,
            'unread_count'  => Notification::where('lu', false)->count(),
        ]);
    }

    public function markAsRead(int $id): JsonResponse
    {
        $notification = Notification::findOrFail($id);
        $notification->update(['lu' => true]);

        return response()->json($notification);
    }

    public function markAllRead(): JsonResponse
    {
        Notification::where('lu', false)->update(['lu' => true]);

        return response()->json(['unread_count' => 0]);
    }
}
