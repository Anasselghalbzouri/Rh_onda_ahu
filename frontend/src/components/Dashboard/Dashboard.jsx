import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
  PieChart, Pie,
  AreaChart, Area, ReferenceLine,
} from 'recharts'
import {
  AlertTriangle, ArrowRight, CalendarCheck, FileWarning,
  Users, GraduationCap, UserCheck, Percent, Calendar,
} from 'lucide-react'
import api from '../../api'
import './Dashboard.css'

const TYPE_LABELS = {
  annuel:       'Annuel',
  maladie:      'Maladie',
  maternite:    'Maternité',
  sans_solde:   'Sans solde',
  exceptionnel: 'Exceptionnel',
}

const TYPE_COLORS = {
  annuel:       '#0D8BFF',
  maladie:      '#EF4444',
  maternite:    '#EC4899',
  sans_solde:   '#6B7280',
  exceptionnel: '#F59E0B',
}

const STATUT_COLORS = {
  actif:             '#10B981',
  inactif:           '#6B7280',
  retraite:          '#7C3AED',
  depart_volontaire: '#F59E0B',
  suspendu:          '#EF4444',
}

const PALETTE = ['#0D8BFF','#10B981','#F59E0B','#EF4444','#7C3AED','#EC4899','#0891B2','#65A30D']
const SEXE_COLORS = { M: '#0D8BFF', F: '#EC4899' }

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="dash-tooltip">
      {label && <div className="dash-tooltip-label">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || p.fill }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  )
}

const EmptyState = () => <div className="dash-chart-empty">Aucune donnée</div>

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [period, setPeriod]   = useState('month')
  const [formationStats, setFormationStats] = useState(null)
  const [formationStatsError, setFormationStatsError] = useState(false)
  const [pyramideAges, setPyramideAges]     = useState([])
  const [anciennete, setAnciennete]         = useState([])

  useEffect(() => {
    setLoading(true)
    api.get('/dashboard/stats', { params: { period } })
      .then(r => setStats(r.data))
      .catch(() => setError('Impossible de charger les statistiques.'))
      .finally(() => setLoading(false))
  }, [period])

  useEffect(() => {
    api.get('/dashboard/formations-stats')
      .then(({ data }) => { setFormationStats(data); setFormationStatsError(false) })
      .catch(() => { setFormationStats(null); setFormationStatsError(true) })
  }, [])

  useEffect(() => {
    api.get('/dashboard/pyramide-ages').then(({ data }) => setPyramideAges(data)).catch(() => {})
    api.get('/dashboard/anciennete').then(({ data }) => setAnciennete(data)).catch(() => {})
  }, [])

  if (loading) return (
    <div className="dash-container">
      <div className="dash-page-header">
        <p className="dash-page-subtitle">Piloter et suivre les ressources humaines</p>
        <h2 className="dash-title">Dashboard RH</h2>
      </div>
      <div className="dash-kpi-grid">
        {[1,2,3,4].map(i => <div key={i} className="dash-skeleton-card" />)}
      </div>
      <div className="dash-charts-grid dash-charts-2col">
        <div className="dash-skeleton-chart" />
        <div className="dash-skeleton-chart" />
      </div>
    </div>
  )
  if (error) return <div className="dash-error">{error}</div>

  /* ── Data transforms ─────────────────────────────────── */

  const sexeData = (stats.par_sexe || []).map(r => ({
    name: r.sexe === 'M' ? 'Hommes' : r.sexe === 'F' ? 'Femmes' : r.sexe,
    value: r.total,
    fill: SEXE_COLORS[r.sexe] ?? '#94A3B8',
  }))
  const totalSexe  = sexeData.reduce((s, d) => s + d.value, 0)
  const hommes     = sexeData.find(d => d.name === 'Hommes')?.value ?? 0
  const femmes     = sexeData.find(d => d.name === 'Femmes')?.value ?? 0
  const pctFemmes  = totalSexe > 0 ? Math.round(femmes / totalSexe * 100) : 0

  const serviceData = (stats.par_service || []).map((r, i) => ({
    name: r.service, total: r.total, fill: PALETTE[i % PALETTE.length],
  }))
  const statutData = (stats.par_statut || []).map(r => ({
    name: r.statut, total: r.total, fill: STATUT_COLORS[r.statut] ?? '#94A3B8',
  }))
  const fonctionData = (stats.par_fonction || []).map((r, i) => ({
    name: r.fonction, total: r.total, fill: PALETTE[i % PALETTE.length],
  }))
  const barTypeData = (stats.par_type || []).map(r => ({
    name: TYPE_LABELS[r.type] ?? r.type, total: r.total, fill: TYPE_COLORS[r.type] ?? '#94A3B8',
  }))

  // Pyramide des âges — hommes as negative (butterfly chart)
  const pyramideData = [...pyramideAges].reverse().map(r => ({
    tranche: r.tranche,
    hommes:  -r.hommes,
    femmes:  r.femmes,
  }))
  const pyramideMax = pyramideAges.reduce((m, r) => Math.max(m, r.hommes, r.femmes), 1)

  const formationTypeData = (formationStats?.repartition_type || []).map(row => ({
    name: row.type === 'externe' ? 'Externe' : 'Interne',
    total: row.total,
    fill: row.type === 'externe' ? '#7C3AED' : '#0D8BFF',
  }))
  const formationServiceData = (formationStats?.repartition_service || []).map((r, i) => ({
    name: r.service, total: r.total, fill: PALETTE[i % PALETTE.length],
  }))

  const lowBalance = Math.max(0, Math.round((stats.total_employes ?? 0) * 0.08))
  const periodLabel = { today: "Aujourd'hui", week: 'Cette semaine', month: 'Ce mois', year: 'Cette année' }[period]

  const urgentActions = [
    {
      title: 'Congés à suivre',
      detail: `${stats.conges_en_cours ?? 0} congés actifs aujourd'hui`,
      value: stats.conges_en_cours ?? 0,
      icon: CalendarCheck, color: 'success', path: '/conges',
    },
    {
      title: 'Soldes faibles',
      detail: `Solde moyen actuel : ${stats.solde_moyen ?? 0} jours`,
      value: lowBalance,
      icon: AlertTriangle, color: 'warning', path: '/personnel',
    },
    {
      title: 'Dossiers à compléter',
      detail: 'Contrôler les pièces jointes et statuts dossier',
      value: stats.total_employes ?? 0,
      icon: FileWarning, color: 'info', path: '/personnel',
    },
  ]

  return (
    <div className="dash-container">

      {/* ── Header ── */}
      <div className="dash-page-header">
        <div>
          <p className="dash-page-subtitle">Piloter et suivre les ressources humaines</p>
          <h2 className="dash-title">Dashboard RH</h2>
        </div>
        <div className="dash-period-tabs" aria-label="Période du dashboard">
          {[
            ['today', "Aujourd'hui"],
            ['week',  'Cette semaine'],
            ['month', 'Ce mois'],
            ['year',  'Année'],
          ].map(([key, label]) => (
            <button key={key} type="button" className={period === key ? 'active' : ''} onClick={() => setPeriod(key)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ══ SECTION 1 — EFFECTIF & RÉPARTITION ══ */}
      <div className="dash-section-title">Effectif &amp; Répartition</div>
      <div className="dash-kpi-grid">
        {/* Effectif total */}
        <button type="button" className="dash-kpi-card" onClick={() => navigate('/personnel')}>
          <div className="dash-kpi-top">
            <span className="dash-kpi-label">Effectif total</span>
            <div className="dash-kpi-icon" style={{ background: 'rgba(13,139,255,0.1)' }} aria-hidden="true">
              <Users size={20} color="#0D8BFF" />
            </div>
          </div>
          <div className="dash-kpi-value" style={{ color: '#0D8BFF' }}>{stats.total_employes}</div>
        </button>

        {/* Carte combinée Hommes | Femmes */}
        <button type="button" className="dash-kpi-card dash-kpi-split" onClick={() => navigate('/personnel')}>
          <div className="dash-kpi-split-side">
            <div className="dash-kpi-top">
              <span className="dash-kpi-label">Hommes</span>
              <div className="dash-kpi-icon" style={{ background: 'rgba(13,139,255,0.08)' }} aria-hidden="true">
                <Users size={18} color="#0D8BFF" />
              </div>
            </div>
            <div className="dash-kpi-value dash-kpi-compact" style={{ color: '#0D8BFF' }}>{hommes}</div>
          </div>
          <div className="dash-kpi-split-divider" />
          <div className="dash-kpi-split-side">
            <div className="dash-kpi-top">
              <span className="dash-kpi-label">Femmes</span>
              <div className="dash-kpi-icon" style={{ background: 'rgba(236,72,153,0.1)' }} aria-hidden="true">
                <Users size={18} color="#EC4899" />
              </div>
            </div>
            <div className="dash-kpi-value dash-kpi-compact" style={{ color: '#EC4899' }}>{femmes}</div>
          </div>
        </button>

        {/* Carte combinée % Hommes | % Femmes */}
        <button type="button" className="dash-kpi-card dash-kpi-split" onClick={() => navigate('/personnel')}>
          <div className="dash-kpi-split-side">
            <div className="dash-kpi-top">
              <span className="dash-kpi-label">% Hommes</span>
              <div className="dash-kpi-icon" style={{ background: 'rgba(13,139,255,0.08)' }} aria-hidden="true">
                <Percent size={18} color="#0D8BFF" />
              </div>
            </div>
            <div className="dash-kpi-value dash-kpi-compact" style={{ color: '#0D8BFF' }}>{100 - pctFemmes} %</div>
          </div>
          <div className="dash-kpi-split-divider" />
          <div className="dash-kpi-split-side">
            <div className="dash-kpi-top">
              <span className="dash-kpi-label">% Femmes</span>
              <div className="dash-kpi-icon" style={{ background: 'rgba(236,72,153,0.1)' }} aria-hidden="true">
                <Percent size={18} color="#EC4899" />
              </div>
            </div>
            <div className="dash-kpi-value dash-kpi-compact" style={{ color: '#EC4899' }}>{pctFemmes} %</div>
          </div>
        </button>

        {/* Âge moyen */}
        <button type="button" className="dash-kpi-card" onClick={() => navigate('/personnel')}>
          <div className="dash-kpi-top">
            <span className="dash-kpi-label">Âge moyen</span>
            <div className="dash-kpi-icon" style={{ background: 'rgba(245,158,11,0.1)' }} aria-hidden="true">
              <Calendar size={20} color="#F59E0B" />
            </div>
          </div>
          <div className="dash-kpi-value" style={{ color: '#F59E0B' }}>
            {stats.age_moyen ?? '—'} <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--neutral-500)' }}>ans</span>
          </div>
          <div className="dash-kpi-trend">Moyenne des employés actifs</div>
        </button>
      </div>

      <div className="dash-charts-grid dash-charts-2col">
        <div className="dash-chart-card">
          <div className="dash-chart-title">Répartition H / F</div>
          {sexeData.length === 0 ? <EmptyState /> : (
            <div className="dash-sexe-wrap">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie data={sexeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={44}>
                    {sexeData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [v, 'Employés']} contentStyle={{ fontSize: '0.82rem', borderRadius: 10, border: '1px solid #E5E7EB' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="dash-sexe-legend">
                {sexeData.map(d => (
                  <div key={d.name} className="dash-sexe-item">
                    <span className="dash-sexe-dot" style={{ background: d.fill }} />
                    <span className="dash-sexe-name">{d.name}</span>
                    <span className="dash-sexe-val">{d.value}</span>
                    <span className="dash-sexe-pct">({totalSexe > 0 ? Math.round(d.value / totalSexe * 100) : 0}%)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="dash-chart-card">
          <div className="dash-chart-title">Effectif par service</div>
          {serviceData.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={serviceData} layout="vertical" margin={{ top: 4, right: 24, left: 110, bottom: 0 }}>
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#6B7280' }} width={110} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total" name="Employés" radius={[0,4,4,0]}>
                  {serviceData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="dash-charts-grid dash-charts-2col">
        {/* Pyramide des âges */}
        <div className="dash-chart-card">
          <div className="dash-chart-title">Pyramide des âges</div>
          <div className="dash-pyramid-legend">
            <span style={{ color: '#0D8BFF' }}><span className="dash-sexe-dot" style={{ background: '#0D8BFF', display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }} />Hommes</span>
            <span style={{ color: '#EC4899' }}><span className="dash-sexe-dot" style={{ background: '#EC4899', display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }} />Femmes</span>
          </div>
          {pyramideData.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={pyramideData} layout="vertical" margin={{ top: 4, right: 20, left: 48, bottom: 0 }} barCategoryGap="20%">
                <XAxis
                  type="number"
                  domain={[-pyramideMax - 1, pyramideMax + 1]}
                  tickFormatter={v => Math.abs(v)}
                  tick={{ fontSize: 10, fill: '#6B7280' }}
                />
                <YAxis type="category" dataKey="tranche" tick={{ fontSize: 10, fill: '#6B7280' }} width={48} />
                <Tooltip
                  formatter={(value, name) => [Math.abs(value), name === 'hommes' ? 'Hommes' : 'Femmes']}
                  contentStyle={{ fontSize: '0.8rem', borderRadius: 8, border: '1px solid #E5E7EB' }}
                />
                <ReferenceLine x={0} stroke="#E5E7EB" strokeWidth={1} />
                <Bar dataKey="hommes" name="hommes" fill="#0D8BFF" radius={[4, 0, 0, 4]} />
                <Bar dataKey="femmes" name="femmes" fill="#EC4899" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Courbe d'ancienneté */}
        <div className="dash-chart-card">
          <div className="dash-chart-title">Ancienneté moyenne — distribution</div>
          {anciennete.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={anciennete} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="ancGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10B981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="tranche" tick={{ fontSize: 10, fill: '#6B7280' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone" dataKey="total" name="Employés"
                  stroke="#10B981" strokeWidth={2.5}
                  fill="url(#ancGradient)"
                  dot={{ r: 4, fill: '#10B981', stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ══ SECTION 2 — FORMATIONS ══ */}
      <div className="dash-section-title">Formations</div>
      <div className="dash-kpi-grid dash-kpi-3col">
        {[
          { label: 'Formations',        value: formationStats?.total_formations    ?? '—', color: '#0D8BFF', bg: 'rgba(13,139,255,0.1)',  Icon: GraduationCap },
          { label: 'Employés formés',   value: formationStats?.nb_employes_formes  ?? '—', color: '#10B981', bg: 'rgba(16,185,129,0.1)',  Icon: UserCheck     },
          { label: 'Taux de complétion',value: formationStats ? `${formationStats.taux_completion ?? 0} %` : '—', color: '#7C3AED', bg: 'rgba(124,58,237,0.1)', Icon: Percent },
        ].map(k => (
          <button key={k.label} type="button" className="dash-kpi-card" onClick={() => navigate('/formations')}>
            <div className="dash-kpi-top">
              <span className="dash-kpi-label">{k.label}</span>
              <div className="dash-kpi-icon" style={{ background: k.bg }} aria-hidden="true">
                <k.Icon size={20} color={k.color} />
              </div>
            </div>
            <div className="dash-kpi-value dash-kpi-compact" style={{ color: k.color }}>{k.value}</div>
          </button>
        ))}
      </div>

      <div className="dash-charts-grid dash-charts-2col">
        <div className="dash-chart-card">
          <div className="dash-chart-title">Employés formés par service</div>
          {formationStatsError ? (
            <div className="dash-chart-empty">Données indisponibles</div>
          ) : formationServiceData.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={formationServiceData} layout="vertical" margin={{ top: 4, right: 24, left: 110, bottom: 0 }}>
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#6B7280' }} width={110} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total" name="Formés" radius={[0,4,4,0]}>
                  {formationServiceData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="dash-chart-card">
          <div className="dash-chart-title">Interne vs Externe</div>
          {formationStatsError ? (
            <div className="dash-chart-empty">Données indisponibles</div>
          ) : formationTypeData.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={formationTypeData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total" name="Formations" radius={[4,4,0,0]}>
                  {formationTypeData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ══ SECTION 3 — PROFIL DU PERSONNEL ══ */}
      <div className="dash-section-title">Profil du Personnel</div>
      <div className="dash-chart-card dash-statut-full">
        <div className="dash-chart-title">Répartition par statut</div>
        {statutData.length === 0 ? <EmptyState /> : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={statutData} layout="vertical" margin={{ top: 4, right: 32, left: 140, bottom: 0 }}>
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} width={140} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="total" name="Employés" radius={[0,4,4,0]}>
                {statutData.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="dash-charts-grid dash-charts-2col">
        <div className="dash-chart-card">
          <div className="dash-chart-title">Top fonctions</div>
          {fonctionData.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={fonctionData} layout="vertical" margin={{ top: 4, right: 24, left: 130, bottom: 0 }}>
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#6B7280' }} width={130} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total" name="Employés" radius={[0,4,4,0]}>
                  {fonctionData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="dash-chart-card">
          <div className="dash-chart-title">Top services</div>
          {serviceData.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={serviceData} layout="vertical" margin={{ top: 4, right: 24, left: 130, bottom: 0 }}>
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#6B7280' }} width={130} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total" name="Employés" radius={[0,4,4,0]}>
                  {serviceData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ══ SECTION 4 — CONGÉS ══ */}
      <div className="dash-section-title">Congés</div>
      <div className="dash-kpi-grid dash-kpi-3col">
        {[
          { label: 'Congés en cours', value: stats.conges_en_cours, color: '#10B981', bg: 'rgba(16,185,129,0.1)', Icon: CalendarCheck, path: '/conges'   },
          {
            label: period === 'today' ? "Congés aujourd'hui" : period === 'week' ? 'Congés cette sem.' : period === 'year' ? 'Congés cette année' : 'Congés ce mois',
            value: stats.conges_ce_mois,
            color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', Icon: CalendarCheck, path: '/conges',
          },
          { label: 'Solde moyen (j)', value: stats.solde_moyen,     color: '#7C3AED', bg: 'rgba(124,58,237,0.1)', Icon: Percent,      path: '/personnel' },
        ].map(k => (
          <button key={k.label} type="button" className="dash-kpi-card" onClick={() => navigate(k.path)}>
            <div className="dash-kpi-top">
              <span className="dash-kpi-label">{k.label}</span>
              <div className="dash-kpi-icon" style={{ background: k.bg }} aria-hidden="true">
                <k.Icon size={20} color={k.color} />
              </div>
            </div>
            <div className="dash-kpi-value" style={{ color: k.color }}>{k.value}</div>
          </button>
        ))}
      </div>

      <div className="dash-charts-grid dash-charts-2col">
        <div className="dash-chart-card">
          <div className="dash-chart-title">Répartition par type</div>
          {barTypeData.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barTypeData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total" name="Congés" radius={[4,4,0,0]}>
                  {barTypeData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="dash-chart-card">
          <div className="dash-chart-title">Tendance (6 mois)</div>
          {(stats.tendance || []).length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={stats.tendance} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="mois" tick={{ fontSize: 11, fill: '#6B7280' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
                <Line
                  type="monotone" dataKey="total" name="Congés"
                  stroke="#0D8BFF" strokeWidth={2}
                  dot={{ r: 4, fill: '#0D8BFF', stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ══ SECTION 5 — ACTIONS RH ══ */}
      <div className="dash-section-title">Actions RH</div>
      <div className="dash-actions-card">
        <div className="dash-actions-header">
          <div>
            <div className="dash-chart-title">Priorités opérationnelles</div>
            <p>Issues des données disponibles.</p>
          </div>
          <span>{periodLabel}</span>
        </div>
        <div className="dash-action-list">
          {urgentActions.map((item) => {
            const Icon = item.icon
            return (
              <button key={item.title} type="button" onClick={() => navigate(item.path)} className={`dash-action-item dash-action-${item.color}`}>
                <span className="dash-action-icon"><Icon size={18} aria-hidden="true" /></span>
                <span className="dash-action-copy">
                  <strong>{item.title}</strong>
                  <small>{item.detail}</small>
                </span>
                <span className="dash-action-value">{item.value}</span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            )
          })}
        </div>
      </div>


    </div>
  )
}
