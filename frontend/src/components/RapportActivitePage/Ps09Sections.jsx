// Rendu du rapport PS09 section par section (spec 005) : valeurs automatiques
// en lecture seule, valeurs saisies modifiables, taux calculés vs objectif.

import { MOIS, ratio, pct, libelleRecrutement, tauxEngagements } from './ps09'

function Taux({ libelle, valeur, objectif }) {
  const atteint = valeur != null && objectif != null ? valeur >= objectif : null
  return (
    <div className="ps09-taux">
      <span>{libelle}</span>
      <strong>{pct(valeur)}</strong>
      {objectif != null && (
        <span className={`ps09-objectif ${atteint == null ? '' : atteint ? 'ps09-ok' : 'ps09-ko'}`}>
          objectif {pct(objectif)}{atteint == null ? '' : atteint ? ' — objectif atteint' : ' — objectif non atteint'}
        </span>
      )}
    </div>
  )
}

function Section({ code, titre, children }) {
  return (
    <section className="ps09-section">
      <h3><span className="ps09-code">{code}</span> {titre}</h3>
      {children}
    </section>
  )
}

export default function Ps09Sections({ auto, trimestre, annuel, numTrimestre, annee, onChange, errors = {} }) {
  const t = trimestre ?? {}
  const a = annuel ?? {}
  const erreur = (path) => errors[path]?.[0] && <span className="ps09-erreur">{errors[path][0]}</span>

  // Fonctions de rendu (et non composants) : un composant défini ici serait
  // recréé à chaque frappe et le champ perdrait le focus.
  const nombre = (path, libelle, valeur) => (
    <label className="ps09-champ" key={path}>
      {libelle}
      <input type="number" min="0" step="1" value={valeur ?? ''} placeholder="Non renseigné"
        onChange={(e) => onChange(path, e.target.value === '' ? null : Number(e.target.value))} />
      {erreur(path)}
    </label>
  )

  const texte = (path, libelle, valeur, lignes = 3) => (
    <label className="ps09-champ ps09-commentaire">
      {libelle}
      <textarea rows={lignes} maxLength={2000} value={valeur ?? ''} placeholder="Non renseigné"
        onChange={(e) => onChange(path, e.target.value === '' ? null : e.target.value)} />
      {erreur(path)}
    </label>
  )

  const commentaire = (cle) => texte(`trimestre.commentaires.${cle}`, 'Commentaire(s)', t.commentaires?.[cle])

  const f = auto?.formation
  const e = auto?.effectif
  const rec = t.reclamations ?? {}
  const pa = t.plan_action ?? {}
  const eng = t.engagements ?? [{}, {}, {}]
  const tauxEng = tauxEngagements(eng)
  const st = a.stages ?? {}
  const po = a.polyvalence ?? {}
  const besoins = a.recrutement?.besoins
  const ex = a.exigences ?? {}
  const postes = auto?.postes

  return (
    <div className="ps09-sections">
      <h2 className="ps09-titre-partie">I - Ressources humaines — T{numTrimestre} {annee}</h2>

      <Section code="I.A" titre="Évaluation de l'efficacité des formations">
        {f && (
          <div className="ps09-auto">
            <span>Formations évaluées : <strong>{f.evaluees}</strong></span>
            <span>Formations efficaces : <strong>{f.efficaces}</strong></span>
            <Taux libelle="Taux d'efficacité" valeur={ratio(f.efficaces, f.evaluees)} objectif={0.95} />
          </div>
        )}
        {commentaire('ia')}
      </Section>

      <Section code="I.B" titre="Recrutement / Réaffectation">
        <div className="ps09-auto ps09-auto-liste">
          <span className="ps09-auto-titre">Recrutements {annee} (calculés depuis les employés)</span>
          {auto?.recrutements?.length
            ? <ul>{auto.recrutements.map((r) => <li key={`${r.mois}-${r.fonction}`}>{libelleRecrutement(r, annee)}</li>)}</ul>
            : <span>Aucun recrutement enregistré en {annee}.</span>}
        </div>
        {commentaire('ib')}
      </Section>
      <Section code="I.C" titre="Évaluation à froid des formations réalisées">{commentaire('ic')}</Section>

      <Section code="I.D" titre="Taux de satisfaction des réclamations du personnel">
        <div className="ps09-grille">
          {nombre('trimestre.reclamations.recues', 'Réclamations reçues', rec.recues)}
          {nombre('trimestre.reclamations.satisfaites', 'Réclamations satisfaites', rec.satisfaites)}
          <div className="ps09-champ">
            Non satisfaites
            <span className="ps09-valeur">{rec.recues != null && rec.satisfaites != null ? rec.recues - rec.satisfaites : '—'}</span>
          </div>
        </div>
        <Taux libelle="Taux de satisfaction" valeur={ratio(rec.satisfaites, rec.recues)} objectif={0.8} />
        {commentaire('id')}
      </Section>

      <Section code="I.E" titre="Formation">
        {f && (
          <div className="ps09-auto">
            <span>Formations planifiées : <strong>{f.planifiees}</strong></span>
            <span>Formations réalisées : <strong>{f.realisees}</strong></span>
            <Taux libelle="Taux de réalisation" valeur={ratio(f.realisees, f.planifiees)} objectif={0.95} />
          </div>
        )}
        {commentaire('ie')}
      </Section>

      <Section code="I.F" titre="Accidents de travail">
        <div className="ps09-grille">
          {nombre('trimestre.accidents_travail', "Nombre d'accidents de travail", t.accidents_travail)}
        </div>
        {commentaire('if')}
      </Section>

      <Section code="I.G" titre="Suivi des engagements RH vis-à-vis du siège">
        <div className="ps09-grille">
          {[0, 1, 2].map((i) => (
            <div key={i} className="ps09-mois">
              <span className="ps09-mois-nom">{MOIS[(numTrimestre - 1) * 3 + i]}</span>
              {nombre(`trimestre.engagements.${i}.prevu`, 'Prévu', eng[i]?.prevu)}
              {nombre(`trimestre.engagements.${i}.realise`, 'Réalisé', eng[i]?.realise)}
            </div>
          ))}
        </div>
        {erreur('trimestre.engagements')}
        <Taux libelle="Taux de réalisation du trimestre" valeur={tauxEng} />
        {commentaire('ig')}
      </Section>

      <h2 className="ps09-titre-partie">II - État d'avancement du plan d'action</h2>
      <Section code="II" titre="Plan d'action">
        <div className="ps09-grille">
          {nombre('trimestre.plan_action.actions', "Nombre d'actions", pa.actions)}
          {nombre('trimestre.plan_action.echues', 'Actions échues', pa.echues)}
          {nombre('trimestre.plan_action.cloturees', 'Actions clôturées', pa.cloturees)}
        </div>
        <Taux libelle="Taux de clôture (clôturées / échues)" valeur={ratio(pa.cloturees, pa.echues)} />
        {texte('trimestre.plan_action.recommandation', 'Recommandation', pa.recommandation, 2)}
      </Section>

      <h2 className="ps09-titre-partie">IV - Indicateurs RH</h2>
      <Section code="IV.a" titre="Intégration des nouvelles recrues">
        {e && <div className="ps09-auto"><span>Effectif intégré / recrutements satisfaits en {annee} : <strong>{e.integres}</strong></span></div>}
        <div className="ps09-grille">
          {nombre('annuel.recrutement.besoins', `Besoins en recrutement exprimés (${annee})`, besoins)}
        </div>
        <Taux libelle="Taux de satisfaction en recrutement" valeur={ratio(e?.integres, besoins)} objectif={0.8} />
        <div className="ps09-grille">
          {nombre('annuel.exigences.controleurs', 'Exigence contrôleurs', ex.controleurs)}
          <div className="ps09-champ">Contrôleurs en poste<span className="ps09-valeur">{postes?.controleurs ?? '—'}</span></div>
          {nombre('annuel.exigences.pompiers', 'Exigence pompiers', ex.pompiers)}
          <div className="ps09-champ">Pompiers en poste<span className="ps09-valeur">{postes?.pompiers ?? '—'}</span></div>
        </div>
        <Taux
          libelle="Couverture de l'exigence"
          valeur={ratio(postes && (postes.controleurs + postes.pompiers), (ex.controleurs ?? 0) + (ex.pompiers ?? 0))}
          objectif={1}
        />
        {commentaire('iva')}
      </Section>

      <Section code="IV.b" titre="Départs anticipés">
        {e && (
          <div className="ps09-auto">
            <span>Départs en {annee} : <strong>{e.departs}</strong></span>
            <span>Mutations en {annee} : <strong>{e.mutations}</strong></span>
          </div>
        )}
        {commentaire('ivb')}
      </Section>

      <Section code="IV.c" titre={`Stages (année ${annee})`}>
        <div className="ps09-grille">
          {nombre('annuel.stages.besoins', 'Besoins en stage identifiés', st.besoins)}
          {nombre('annuel.stages.stagiaires', 'Stagiaires accueillis', st.stagiaires)}
          {nombre('annuel.stages.actions_amelioration', "Actions d'amélioration réalisées", st.actions_amelioration)}
        </div>
        {commentaire('ivc')}
      </Section>

      <Section code="IV.d" titre={`Polyvalence du personnel (année ${annee})`}>
        <div className="ps09-grille">
          {nombre('annuel.polyvalence.competences', 'Compétences de valeur > 1', po.competences)}
          {nombre('annuel.polyvalence.taches', 'Nombre total de tâches du processus', po.taches)}
        </div>
        <Taux libelle="Taux de polyvalence" valeur={ratio(po.competences, po.taches)} />
        {commentaire('ivd')}
      </Section>
    </div>
  )
}
