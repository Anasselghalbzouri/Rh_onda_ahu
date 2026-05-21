import { useEffect, useState } from 'react'
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
  PieChart, Pie,
} from 'recharts'
import { Users, CalendarCheck, TrendingUp, Activity } from 'lucide-react'
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
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    api.get('/dashboard/stats')
      .then(r => setStats(r.data))
      .catch(() => setError('Impossible de charger les statistiques.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="dash-loading">
      <span className="dash-loading-spinner" aria-hidden="true" />
      Chargement des statistiques…
    </div>
  )
  if (error) return <div className="dash-error">{error}</div>

  const kpis = [
    {
      label: 'Effectif total',
      value: stats.total_employes,
      color: '#0D8BFF',
      bg: 'rgba(13,139,255,0.1)',
      Icon: Users,
      trend: null,
    },
    {
      label: 'Congés en cours',
      value: stats.conges_en_cours,
      color: '#10B981',
      bg: 'rgba(16,185,129,0.1)',
      Icon: CalendarCheck,
      trend: null,
    },
    {
      label: 'Congés ce mois',
      value: stats.conges_ce_mois,
      color: '#F59E0B',
      bg: 'rgba(245,158,11,0.1)',
      Icon: Activity,
      trend: null,
    },
    {
      label: 'Solde moyen (j)',
      value: stats.solde_moyen,
      color: '#7C3AED',
      bg: 'rgba(124,58,237,0.1)',
      Icon: TrendingUp,
      trend: null,
    },
  ]

  const barTypeData = (stats.par_type || []).map(r => ({
    name: TYPE_LABELS[r.type] ?? r.type,
    total: r.total,
    fill: TYPE_COLORS[r.type] ?? '#94A3B8',
  }))

  const sexeData = (stats.par_sexe || []).map(r => ({
    name: r.sexe === 'M' ? 'Hommes' : r.sexe === 'F' ? 'Femmes' : r.sexe,
    value: r.total,
    fill: SEXE_COLORS[r.sexe] ?? '#94A3B8',
  }))

  const statutData = (stats.par_statut || []).map(r => ({
    name: r.statut,
    total: r.total,
    fill: STATUT_COLORS[r.statut] ?? '#94A3B8',
  }))

  const fonctionData = (stats.par_fonction || []).map((r, i) => ({
    name: r.fonction,
    total: r.total,
    fill: PALETTE[i % PALETTE.length],
  }))

  const serviceData = (stats.par_service || []).map((r, i) => ({
    name: r.service,
    total: r.total,
    fill: PALETTE[i % PALETTE.length],
  }))

  const totalSexe = sexeData.reduce((s, d) => s + d.value, 0)

  return (
    <div className="dash-container">
      <div className="dash-page-header">
        <p className="dash-page-subtitle">Piloter et suivre les ressources humaines</p>
        <h2 className="dash-title">Dashboard RH</h2>
      </div>

      {/* KPI Row */}
      <div className="dash-kpi-grid">
        {kpis.map(k => (
          <div key={k.label} className="dash-kpi-card">
            <div className="dash-kpi-top">
              <span className="dash-kpi-label">{k.label}</span>
              <div
                className="dash-kpi-icon"
                style={{ background: k.bg }}
                aria-hidden="true"
              >
                <k.Icon size={20} color={k.color} />
              </div>
            </div>
            <div className="dash-kpi-value" style={{ color: k.color }}>
              {k.value}
            </div>
            {k.trend && <div className="dash-kpi-trend">{k.trend}</div>}
          </div>
        ))}
      </div>

      {/* Congés section */}
      <div className="dash-section-title">Congés</div>
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

      {/* Personnel section */}
      <div className="dash-section-title">Personnel</div>
      <div className="dash-charts-grid dash-charts-2col">
        <div className="dash-chart-card">
          <div className="dash-chart-title">Répartition H / F</div>
          {sexeData.length === 0 ? <EmptyState /> : (
            <div className="dash-sexe-wrap">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie
                    data={sexeData} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={80} innerRadius={44}
                  >
                    {sexeData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip
                    formatter={(v) => [v, 'Employés']}
                    contentStyle={{ fontSize: '0.82rem', borderRadius: 10, border: '1px solid #E5E7EB' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="dash-sexe-legend">
                {sexeData.map(d => (
                  <div key={d.name} className="dash-sexe-item">
                    <span className="dash-sexe-dot" style={{ background: d.fill }} />
                    <span className="dash-sexe-name">{d.name}</span>
                    <span className="dash-sexe-val">{d.value}</span>
                    <span className="dash-sexe-pct">
                      ({totalSexe > 0 ? Math.round(d.value / totalSexe * 100) : 0}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="dash-chart-card">
          <div className="dash-chart-title">Répartition par statut</div>
          {statutData.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={statutData} layout="vertical"
                margin={{ top: 4, right: 24, left: 70, bottom: 0 }}>
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} width={70} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total" name="Employés" radius={[0,4,4,0]}>
                  {statutData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Functions & Services */}
      <div className="dash-charts-grid dash-charts-2col">
        <div className="dash-chart-card">
          <div className="dash-chart-title">Top fonctions</div>
          {fonctionData.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={fonctionData} layout="vertical"
                margin={{ top: 4, right: 24, left: 130, bottom: 0 }}>
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
              <BarChart data={serviceData} layout="vertical"
                margin={{ top: 4, right: 24, left: 130, bottom: 0 }}>
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
    </div>
  )
}
