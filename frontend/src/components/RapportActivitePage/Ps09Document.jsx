// Aperçu « document » du rapport PS09 (spec 005, FR-013) : mis à jour en direct
// depuis la saisie, sans rien enregistrer.
import { MOIS, ratio, pct, libelleRecrutement, tauxEngagements } from './ps09'

function Jauge({ libelle, valeur, objectif, detail }) {
  const etat = valeur == null ? 'vide' : objectif == null ? 'neutre' : valeur >= objectif ? 'ok' : 'ko'
  return (
    <div className={`ps09doc-jauge ps09doc-${etat}`}>
      <div className="ps09doc-jauge-entete">
        <span>{libelle}</span>
        <strong>{pct(valeur)}</strong>
      </div>
      <div className="ps09doc-barre">
        <div className="ps09doc-remplissage" style={{ width: `${Math.min(100, (valeur ?? 0) * 100)}%` }} />
        {objectif != null && <div className="ps09doc-cible" style={{ left: `${Math.min(100, objectif * 100)}%` }} title={`Objectif ${pct(objectif)}`} />}
      </div>
      <div className="ps09doc-detail">
        {detail}
        {objectif != null && <span> · objectif {pct(objectif)}{etat === 'ok' ? ' ✔' : etat === 'ko' ? ' ✖' : ''}</span>}
      </div>
    </div>
  )
}

const val = (v) => (v == null ? '—' : v)

function Bloc({ code, titre, commentaire, children }) {
  return (
    <section className="ps09doc-bloc">
      <h4><span>{code}</span> {titre}</h4>
      {children}
      {commentaire
        ? <blockquote className="ps09doc-commentaire">{commentaire}</blockquote>
        : <p className="ps09doc-vide">Commentaire non renseigné</p>}
    </section>
  )
}

export default function Ps09Document({ auto, trimestre, annuel, numTrimestre, annee }) {
  const t = trimestre ?? {}
  const a = annuel ?? {}
  const c = t.commentaires ?? {}
  const f = auto?.formation ?? {}
  const e = auto?.effectif ?? {}
  const postes = auto?.postes ?? {}
  const rec = t.reclamations ?? {}
  const pa = t.plan_action ?? {}
  const eng = t.engagements ?? []
  const st = a.stages ?? {}
  const po = a.polyvalence ?? {}
  const besoins = a.recrutement?.besoins
  const ex = a.exigences ?? {}
  const moisTrimestre = [0, 1, 2].map((i) => MOIS[(numTrimestre - 1) * 3 + i])

  return (
    <article className="ps09doc">
      <header className="ps09doc-entete">
        <div>
          <p className="ps09doc-org">Office National Des Aéroports</p>
          <p className="ps09doc-site">Aéroport AL HOCEIMA ACHARIF AL IDRISSI</p>
        </div>
        <div className="ps09doc-ref">
          <p>Rapport d'Activité Processus RH</p>
          <p>AHU.PS09.E.003/00</p>
          <p className="ps09doc-periode">T{numTrimestre} {annee} · {moisTrimestre[0]} – {moisTrimestre[2]}</p>
        </div>
      </header>

      <div className="ps09doc-kpis">
        <Jauge libelle="Efficacité des formations" valeur={ratio(f.efficaces, f.evaluees)} objectif={0.95} detail={`${val(f.efficaces)} efficaces / ${val(f.evaluees)} évaluées`} />
        <Jauge libelle="Réalisation des formations" valeur={ratio(f.realisees, f.planifiees)} objectif={0.95} detail={`${val(f.realisees)} réalisées / ${val(f.planifiees)} planifiées`} />
        <Jauge libelle="Satisfaction des réclamations" valeur={ratio(rec.satisfaites, rec.recues)} objectif={0.8} detail={`${val(rec.satisfaites)} / ${val(rec.recues)} reçues`} />
        <Jauge libelle="Satisfaction en recrutement" valeur={ratio(e.integres, besoins)} objectif={0.8} detail={`${val(e.integres)} recrutés / ${val(besoins)} besoins`} />
        <Jauge libelle="Engagements siège" valeur={tauxEngagements(eng)} detail="réalisé / prévu du trimestre" />
        <Jauge libelle="Polyvalence" valeur={ratio(po.competences, po.taches)} detail={`${val(po.competences)} / ${val(po.taches)} tâches`} />
      </div>

      <h3 className="ps09doc-partie">I — Ressources humaines</h3>
      <Bloc code="I.A" titre="Efficacité des formations" commentaire={c.ia}>
        <p className="ps09doc-chiffres">{val(f.evaluees)} formation(s) évaluée(s) · {val(f.efficaces)} efficace(s)</p>
      </Bloc>
      <Bloc code="I.B" titre="Recrutement / Réaffectation" commentaire={c.ib}>
        {auto?.recrutements?.length
          ? <ul className="ps09doc-liste">{auto.recrutements.map((r) => <li key={`${r.mois}-${r.fonction}`}>{libelleRecrutement(r, annee)}</li>)}</ul>
          : <p className="ps09doc-chiffres">Aucun recrutement en {annee}.</p>}
      </Bloc>
      <Bloc code="I.C" titre="Évaluation à froid des formations réalisées" commentaire={c.ic} />
      <Bloc code="I.D" titre="Réclamations du personnel" commentaire={c.id}>
        <p className="ps09doc-chiffres">
          {val(rec.recues)} reçue(s) · {val(rec.satisfaites)} satisfaite(s) · {rec.recues != null && rec.satisfaites != null ? rec.recues - rec.satisfaites : '—'} non satisfaite(s)
        </p>
      </Bloc>
      <Bloc code="I.E" titre="Formation" commentaire={c.ie}>
        <p className="ps09doc-chiffres">{val(f.planifiees)} planifiée(s) · {val(f.realisees)} réalisée(s)</p>
      </Bloc>
      <Bloc code="I.F" titre="Accidents de travail" commentaire={c.if}>
        <p className={`ps09doc-chiffres ${t.accidents_travail === 0 ? 'ps09doc-texte-ok' : t.accidents_travail > 0 ? 'ps09doc-texte-ko' : ''}`}>
          {t.accidents_travail == null ? 'Non renseigné' : `${t.accidents_travail} accident(s) de travail${t.accidents_travail === 0 ? ' ✔' : ''}`}
        </p>
      </Bloc>
      <Bloc code="I.G" titre="Engagements RH vis-à-vis du siège" commentaire={c.ig}>
        <table className="ps09doc-table">
          <thead><tr><th>Mois</th><th>Prévu</th><th>Réalisé</th></tr></thead>
          <tbody>
            {moisTrimestre.map((m, i) => (
              <tr key={m}><td>{m}</td><td>{val(eng[i]?.prevu)}</td><td>{val(eng[i]?.realise)}</td></tr>
            ))}
          </tbody>
        </table>
      </Bloc>

      <h3 className="ps09doc-partie">II — Plan d'action</h3>
      <Bloc code="II" titre="État d'avancement" commentaire={pa.recommandation}>
        <p className="ps09doc-chiffres">
          {val(pa.actions)} action(s) · {val(pa.echues)} échue(s) · {val(pa.cloturees)} clôturée(s) · taux de clôture {pct(ratio(pa.cloturees, pa.echues))}
        </p>
      </Bloc>

      <h3 className="ps09doc-partie">IV — Indicateurs RH</h3>
      <Bloc code="IV.a" titre="Intégration des nouvelles recrues" commentaire={c.iva}>
        <p className="ps09doc-chiffres">{val(e.integres)} intégré(s) en {annee} · besoins exprimés : {val(besoins)}</p>
        <table className="ps09doc-table">
          <thead><tr><th></th><th>Contrôleurs</th><th>Pompiers</th></tr></thead>
          <tbody>
            <tr><td>Exigence</td><td>{val(ex.controleurs)}</td><td>{val(ex.pompiers)}</td></tr>
            <tr><td>En poste</td><td>{val(postes.controleurs)}</td><td>{val(postes.pompiers)}</td></tr>
          </tbody>
        </table>
      </Bloc>
      <Bloc code="IV.b" titre="Départs anticipés" commentaire={c.ivb}>
        <p className="ps09doc-chiffres">{val(e.departs)} départ(s) · {val(e.mutations)} mutation(s) en {annee}</p>
      </Bloc>
      <Bloc code="IV.c" titre="Stages" commentaire={c.ivc}>
        <p className="ps09doc-chiffres">{val(st.besoins)} besoin(s) · {val(st.stagiaires)} stagiaire(s) · {val(st.actions_amelioration)} action(s) d'amélioration</p>
      </Bloc>
      <Bloc code="IV.d" titre="Polyvalence du personnel" commentaire={c.ivd}>
        <p className="ps09doc-chiffres">{val(po.competences)} compétence(s) de valeur &gt; 1 sur {val(po.taches)} tâche(s)</p>
      </Bloc>
    </article>
  )
}
