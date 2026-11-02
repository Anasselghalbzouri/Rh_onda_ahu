import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid,
  PieChart, Pie,
  AreaChart, Area, ReferenceLine,
} from 'recharts'
import {
  Users, GraduationCap, UserCheck, Percent, Calendar, CalendarCheck,
} from 'lucide-react'
import api from '../../api'
import ChartCard from './ChartCard'
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

// Thème commun à tous les graphiques du dashboard.
const AXIS_TICK = { fontSize: 11, fill: '#6B7280' }
const GRID      = { strokeDasharray: '3 3', stroke: '#E5E7EB' }
const ANIM      = { animationDuration: 700, animationEasing: 'ease-out' }
const CURSOR    = { fill: 'rgba(13,139,255,0.06)' }

const gradUrl  = (uid, color) => `url(#${uid}${color.slice(1)})`
const gradDefs = (uid, colors, horizontal) => (
  <defs>
    {[...new Set(colors)].map(c => (
      <linearGradient key={c} id={`${uid}${c.slice(1)}`} x1="0" y1="0" x2={horizontal ? 1 : 0} y2={horizontal ? 0 : 1}>
        <stop offset="0%"   stopColor={c} stopOpacity={horizontal ? 0.65 : 1} />
        <stop offset="100%" stopColor={c} stopOpacity={horizontal ? 1 : 0.65} />
      </linearGradient>
    ))}
  </defs>
)

// Barres horizontales (catégories à libellés longs) et verticales ; data[i] = { name, total, fill }.
const hBars = (data, name, labelWidth) => (h, uid) => (
  <ResponsiveContainer width="100%" height={h}>
    <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
      {gradDefs(uid, data.map(d => d.fill), true)}
      <CartesianGrid {...GRID} horizontal={false} />
      <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} />
      <YAxis type="category" dataKey="name" tick={{ ...AXIS_TICK, fontSize: 10 }} width={labelWidth} />
      <Tooltip content={<CustomTooltip />} cursor={CURSOR} />
      <Bar dataKey="total" name={name} radius={[0, 6, 6, 0]} {...ANIM}>
        {data.map((e, i) => <Cell key={i} fill={gradUrl(uid, e.fill)} />)}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
)

const vBars = (data, name) => (h, uid) => (
  <ResponsiveContainer width="100%" height={h}>
    <BarChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
      {gradDefs(uid, data.map(d => d.fill), false)}
      <CartesianGrid {...GRID} vertical={false} />
      <XAxis dataKey="name" tick={AXIS_TICK} />
      <YAxis allowDecimals={false} tick={AXIS_TICK} />
      <Tooltip content={<CustomTooltip />} cursor={CURSOR} />
      <Bar dataKey="total" name={name} radius={[6, 6, 0, 0]} maxBarSize={64} {...ANIM}>
        {data.map((e, i) => <Cell key={i} fill={gradUrl(uid, e.fill)} />)}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
)

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="dash-tooltip">
      {label && <div className="dash-tooltip-label">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: [p.payload?.fill, p.color].find(c => c?.startsWith?.('#')) }}>
          {/* Math.abs : la pyramide des âges dessine les hommes en négatif. */}
          {p.name}: <strong>{Math.abs(p.value)}</strong>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [formationStats, setFormationStats] = useState(null)
  const [formationStatsError, setFormationStatsError] = useState(false)
  const [pyramideAges, setPyramideAges]     = useState([])
  const [anciennete, setAnciennete]         = useState([])

  useEffect(() => {
    api.get('/dashboard/stats')
      .then(r => setStats(r.data))
      .catch(() => setError('Impossible de charger les statistiques.'))
      .finally(() => setLoading(false))
  }, [])

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

  // Pour le graphique en papillon, les hommes sont représentés en valeur négative sur l'axe X.
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



  return (
    <div className="dash-container">

      <div className="dash-page-header">
        <div>
          <p className="dash-page-subtitle">Piloter et suivre les ressources humaines</p>
          <h2 className="dash-title">Dashboard RH </h2>
        </div>
      </div>

     
      <div className="dash-section-title">Effectif &amp; Répartition</div>
      <div className="dash-kpi-grid">
       
        <button type="button" className="dash-kpi-card" onClick={() => navigate('/personnel')}>
          <div className="dash-kpi-top">
            <span className="dash-kpi-label">Effectif total</span>
            <div className="dash-kpi-icon" style={{ background: 'rgba(13,139,255,0.1)' }} aria-hidden="true">
              <Users size={20} color="#0D8BFF" />
            </div>
          </div>
          <div className="dash-kpi-value" style={{ color: '#0D8BFF' }}>{stats.total_employes}</div>
        </button>
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
              <span className="dash-kpi-label">% Femmes </span>
              <div className="dash-kpi-icon" style={{ background: 'rgba(236,72,153,0.1)' }} aria-hidden="true">
                <Percent size={18} color="#EC4899" />
              </div>
            </div>
            <div className="dash-kpi-value dash-kpi-compact" style={{ color: '#EC4899' }}>{pctFemmes} %</div>
          </div>
        </button>

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
        <ChartCard
          title="Répartition H / F" height={200}
          rows={sexeData} labelKey="name" labelHeader="Sexe" series={[{ key: 'value', label: 'Employés' }]}
          render={(h) => (
            <div className="dash-sexe-wrap">
              <ResponsiveContainer width="50%" height={h}>
                <PieChart>
                  <Pie data={sexeData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    outerRadius="90%" innerRadius="56%" paddingAngle={3} cornerRadius={6} {...ANIM}>
                    {sexeData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
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
        />
        <ChartCard
          title="Effectif par service" height={200}
          rows={serviceData} labelKey="name" labelHeader="Service" series={[{ key: 'total', label: 'Employés' }]}
          render={hBars(serviceData, 'Employés', 110)}
        />
      </div>

      <div className="dash-charts-grid dash-charts-2col">
        <ChartCard
          title="Pyramide des âges"
          rows={[...pyramideAges].reverse()} labelKey="tranche" labelHeader="Tranche d'âge"
          series={[{ key: 'hommes', label: 'Hommes' }, { key: 'femmes', label: 'Femmes' }]}
          render={(h, uid) => (
            <>
              <div className="dash-pyramid-legend">
                <span style={{ color: SEXE_COLORS.M }}><span className="dash-sexe-dot dash-dot-inline" style={{ background: SEXE_COLORS.M }} />Hommes</span>
                <span style={{ color: SEXE_COLORS.F }}><span className="dash-sexe-dot dash-dot-inline" style={{ background: SEXE_COLORS.F }} />Femmes</span>
              </div>
              <ResponsiveContainer width="100%" height={h}>
                <BarChart data={pyramideData} layout="vertical" margin={{ top: 4, right: 20, left: 0, bottom: 0 }} barCategoryGap="20%">
                  {gradDefs(uid, [SEXE_COLORS.M, SEXE_COLORS.F], true)}
                  <CartesianGrid {...GRID} horizontal={false} />
                  <XAxis type="number" domain={[-pyramideMax - 1, pyramideMax + 1]} tickFormatter={v => Math.abs(v)} tick={AXIS_TICK} />
                  <YAxis type="category" dataKey="tranche" tick={AXIS_TICK} width={52} />
                  <Tooltip content={<CustomTooltip />} cursor={CURSOR} />
                  <ReferenceLine x={0} stroke="#CBD5E1" strokeWidth={1} />
                  <Bar dataKey="hommes" name="Hommes" fill={gradUrl(uid, SEXE_COLORS.M)} radius={[6, 0, 0, 6]} {...ANIM} />
                  <Bar dataKey="femmes" name="Femmes" fill={gradUrl(uid, SEXE_COLORS.F)} radius={[0, 6, 6, 0]} {...ANIM} />
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        />
        <ChartCard
          title="Ancienneté moyenne — distribution"
          rows={anciennete} labelKey="tranche" labelHeader="Ancienneté" series={[{ key: 'total', label: 'Employés' }]}
          render={(h, uid) => (
            <ResponsiveContainer width="100%" height={h}>
              <AreaChart data={anciennete} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id={`${uid}anc`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10B981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...GRID} vertical={false} />
                <XAxis dataKey="tranche" tick={AXIS_TICK} />
                <YAxis allowDecimals={false} tick={AXIS_TICK} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone" dataKey="total" name="Employés"
                  stroke="#10B981" strokeWidth={2.5}
                  fill={`url(#${uid}anc)`}
                  dot={{ r: 4, fill: '#10B981', stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                  {...ANIM}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        />
      </div>

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
        <ChartCard
          title="Employés formés par service" height={220}
          disabled={formationStatsError} emptyText={formationStatsError ? 'Données indisponibles' : undefined}
          rows={formationServiceData} labelKey="name" labelHeader="Service" series={[{ key: 'total', label: 'Employés formés' }]}
          render={hBars(formationServiceData, 'Formés', 110)}
        />
        <ChartCard
          title="Interne vs Externe" height={220}
          disabled={formationStatsError} emptyText={formationStatsError ? 'Données indisponibles' : undefined}
          rows={formationTypeData} labelKey="name" labelHeader="Type" series={[{ key: 'total', label: 'Formations' }]}
          render={vBars(formationTypeData, 'Formations')}
        />
      </div>

      <div className="dash-section-title">Profil du Personnel</div>
      <ChartCard
        title="Répartition par statut" height={180} className="dash-statut-full"
        rows={statutData} labelKey="name" labelHeader="Statut" series={[{ key: 'total', label: 'Employés' }]}
        render={hBars(statutData, 'Employés', 140)}
      />

      <div className="dash-charts-grid dash-charts-2col">
        <ChartCard
          title="Top fonctions" height={260}
          rows={fonctionData} labelKey="name" labelHeader="Fonction" series={[{ key: 'total', label: 'Employés' }]}
          render={hBars(fonctionData, 'Employés', 130)}
        />
        <ChartCard
          title="Top services" height={260}
          rows={serviceData} labelKey="name" labelHeader="Service" series={[{ key: 'total', label: 'Employés' }]}
          render={hBars(serviceData, 'Employés', 130)}
        />
      </div>

      <div className="dash-section-title">Congés</div>
      <div className="dash-kpi-grid dash-kpi-3col">
        {[
          { label: 'Congés en cours', value: stats.conges_en_cours, color: '#10B981', bg: 'rgba(16,185,129,0.1)', Icon: CalendarCheck, path: '/conges'   },
          {
            label: 'Congés ce mois',
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
        <ChartCard
          title="Répartition par type" height={220}
          rows={barTypeData} labelKey="name" labelHeader="Type" series={[{ key: 'total', label: 'Congés' }]}
          render={vBars(barTypeData, 'Congés')}
        />
        <ChartCard
          title="Tendance (6 mois)" height={220}
          rows={stats.tendance || []} labelKey="mois" labelHeader="Mois" series={[{ key: 'total', label: 'Congés' }]}
          render={(h, uid) => (
            <ResponsiveContainer width="100%" height={h}>
              <AreaChart data={stats.tendance} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id={`${uid}tend`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#0D8BFF" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0D8BFF" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...GRID} vertical={false} />
                <XAxis dataKey="mois" tick={AXIS_TICK} />
                <YAxis allowDecimals={false} tick={AXIS_TICK} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone" dataKey="total" name="Congés"
                  stroke="#0D8BFF" strokeWidth={2.5}
                  fill={`url(#${uid}tend)`}
                  dot={{ r: 4, fill: '#0D8BFF', stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                  {...ANIM}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        />
      </div>



    </div>
  )
}
