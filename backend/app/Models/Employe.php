<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Employe extends Model
{
    protected $table = 'employe';

    public $timestamps = false;

    protected $fillable = [
        'matricule',
        'nom',
        'prenom',
        'sexe',
        'date_naissance',
        'date_embauche',
        'categorie',
        'echelle',
        'echelon',
        'entite',
        'fonction',
        'qualification',
        'service_id',
        'affectation',
        'date_affectation',
        'mutation',
        'date_mutation',
        'retraite',
        'date_retraite',
        'depart_volontaire',
        'date_depart_volontaire',
        'observation',
        'solde_conge',
        'statut',
    ];

    protected $casts = [
        'date_naissance' => 'date',
        'date_embauche' => 'date',
        'date_affectation' => 'date',
        'date_mutation' => 'date',
        'date_retraite' => 'date',
        'date_depart_volontaire' => 'date',
        'retraite' => 'boolean',
        'depart_volontaire' => 'boolean',
        'solde_conge' => 'float',
    ];

    private const CHAMPS_CARRIERE = ['fonction', 'entite', 'categorie', 'echelle'];

    protected static function booted(): void
    {
        // Événements modèle : un seul point couvre les 5 chemins d'écriture
        // (fiche, bulk-sync, imports Excel, commande artisan).
        static::created(function (Employe $e) {
            if ($e->estEnPoste()) {
                $e->ouvrirPeriode($e->date_affectation ?? $e->date_embauche ?? today());
            }
        });

        static::updated(function (Employe $e) {
            // Départ prioritaire : clôture sans réouverture.
            if ($e->wasChanged('statut') && in_array($e->statut, ['retraite', 'parti'], true)) {
                $e->clorePeriode(($e->statut === 'retraite' ? $e->date_retraite : $e->date_depart_volontaire) ?? today());

                return;
            }
            if ($e->estEnPoste() && $e->wasChanged(self::CHAMPS_CARRIERE)) {
                $e->clorePeriode(today());
                $e->ouvrirPeriode(today());
            }
        });
    }

    private function estEnPoste(): bool
    {
        return in_array($this->statut ?? 'actif', ['actif', 'mute'], true);
    }

    private function ouvrirPeriode($debut): void
    {
        $this->historiqueProfessionnel()->create([
            'poste' => $this->fonction,
            'service' => $this->entite,
            'categorie' => $this->categorie,
            'echelle' => $this->echelle,
            'date_debut' => $debut,
        ]);
    }

    private function clorePeriode($fin): void
    {
        $this->historiqueProfessionnel()->whereNull('date_fin')->update(['date_fin' => Carbon::parse($fin)->startOfDay()]);
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class, 'service_id');
    }

    public function dossierPersonnel(): HasMany
    {
        return $this->hasMany(DossierPersonnel::class, 'employe_id');
    }

    public function historiqueProfessionnel(): HasMany
    {
        return $this->hasMany(HistoriqueProfessionnel::class, 'employe_id');
    }

    public function demandesConge(): HasMany
    {
        return $this->hasMany(DemandeConge::class, 'employe_id');
    }

    public function absences(): HasMany
    {
        return $this->hasMany(Absence::class, 'employe_id');
    }

    public function piecesJointes(): HasMany
    {
        return $this->hasMany(PieceJointe::class, 'entite_id')
            ->where('entite', 'employe');
    }

    public function getNomCompletAttribute(): string
    {
        return "{$this->prenom} {$this->nom}";
    }

    public function formations(): BelongsToMany
    {
        return $this->belongsToMany(Formation::class, 'employe_formation', 'employe_id', 'formation_id')
            ->withPivot('statut', 'suivi', 'remarque');
    }

    public function evaluationsFormation(): HasMany
    {
        return $this->hasMany(EvaluationFormation::class, 'employe_id');
    }

    public function isActif(): bool
    {
        return $this->statut === 'actif';
    }
}
