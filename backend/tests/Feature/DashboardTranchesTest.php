<?php

namespace Tests\Feature;

use App\Models\Employe;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class DashboardTranchesTest extends TestCase
{
    use RefreshDatabase;

    private int $seq = 0;

    private function employe(array $attrs): void
    {
        Employe::forceCreate($attrs + [
            'matricule' => sprintf('%06d', ++$this->seq),
            'nom' => 'DOE',
            'prenom' => 'Jane',
        ]);
    }

    private function tranche(array $rows, string $label): array
    {
        return collect($rows)->firstWhere('tranche', $label);
    }

    public function test_anciennete_boundaries_and_retraites_excluded(): void
    {
        $this->withoutMiddleware();
        Carbon::setTestNow('2026-10-27');

        $this->employe(['date_embauche' => '2021-10-27']); // exactement 5 ans
        $this->employe(['date_embauche' => '2021-10-28']); // 5 ans moins un jour
        $this->employe(['date_embauche' => '2021-10-27', 'statut' => 'retraite']);
        $this->employe(['date_embauche' => null]);

        $rows = $this->getJson('/api/dashboard/anciennete')->assertOk()->json();

        $this->assertSame(1, $this->tranche($rows, '5-9 ans')['total']);
        $this->assertSame(1, $this->tranche($rows, '< 5 ans')['total']);
        $this->assertSame(2, array_sum(array_column($rows, 'total')));
    }

    public function test_pyramide_ages_splits_by_sexe_and_birthday_boundary(): void
    {
        $this->withoutMiddleware();
        Carbon::setTestNow('2026-10-27');

        $this->employe(['sexe' => 'M', 'date_naissance' => '1996-10-27']); // 30 ans aujourd'hui
        $this->employe(['sexe' => 'F', 'date_naissance' => '1996-10-28']); // 29 ans
        $this->employe(['sexe' => 'F', 'date_naissance' => '1960-01-01']); // 66 ans

        $rows = $this->getJson('/api/dashboard/pyramide-ages')->assertOk()->json();

        $this->assertSame(['tranche' => '30-34', 'hommes' => 1, 'femmes' => 0], $this->tranche($rows, '30-34'));
        $this->assertSame(['tranche' => '25-29', 'hommes' => 0, 'femmes' => 1], $this->tranche($rows, '25-29'));
        $this->assertSame(1, $this->tranche($rows, '60+')['femmes']);
    }

    public function test_stats_age_moyen_works_on_sqlite(): void
    {
        $this->withoutMiddleware();
        Carbon::setTestNow('2026-10-27');

        $this->employe(['sexe' => 'M', 'date_naissance' => '1996-10-27']); // 30 ans
        $this->employe(['sexe' => 'F', 'date_naissance' => '1996-10-28']); // 29 ans
        $this->employe(['sexe' => 'F', 'date_naissance' => '1960-01-01', 'statut' => 'retraite']); // exclu

        $this->getJson('/api/dashboard/stats')->assertOk()->assertJsonPath('age_moyen', 29.5);
    }
}
