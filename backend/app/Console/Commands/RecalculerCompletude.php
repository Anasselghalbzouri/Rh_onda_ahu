<?php

namespace App\Console\Commands;

use App\Models\Employe;
use App\Services\CompletudeService;
use Illuminate\Console\Command;

class RecalculerCompletude extends Command
{
    protected $signature = 'app:recalculer-completude';

    protected $description = 'Recalcule le taux de complétude de tous les employés';

    public function handle(CompletudeService $completude): int
    {
        $total = 0;

        Employe::query()->chunkById(200, function ($employes) use ($completude, &$total) {
            foreach ($employes as $employe) {
                $completude->recalculer($employe);
                $total++;
            }
        });

        $this->info("Complétude recalculée pour {$total} employé(s).");

        return self::SUCCESS;
    }
}
