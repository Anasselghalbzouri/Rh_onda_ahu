import { useId, useState } from 'react'
import { Maximize2 } from 'lucide-react'
import Modal from '../ui/Modal/Modal'
import { buildChartTable } from './chartTable'

// Carte graphique cliquable : le même render() dessine la carte et la fenêtre, donc mêmes données.
export default function ChartCard({
  title, rows, labelKey, labelHeader, series, render,
  height = 240, disabled = false, emptyText = 'Aucune donnée', className = '',
}) {
  const [open, setOpen] = useState(false)
  // Ids de dégradés SVG distincts entre la carte et la fenêtre, affichées en même temps.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const active = !disabled && rows.length > 0
  const table = open ? buildChartTable(rows, labelKey, series) : null

  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true) }
  }

  return (
    <>
      <div
        className={`dash-chart-card ${className}`}
        {...(active && {
          role: 'button', tabIndex: 0, 'aria-haspopup': 'dialog',
          'aria-label': `Voir le détail : ${title}`,
          onClick: () => setOpen(true), onKeyDown,
        })}
      >
        <div className="dash-chart-head">
          <div className="dash-chart-title">{title}</div>
          {active && (
            <span className="dash-chart-hint" aria-hidden="true">
              <Maximize2 size={13} /> Voir le détail
            </span>
          )}
        </div>
        {active ? render(height, `c${uid}`) : <div className="dash-chart-empty">{emptyText}</div>}
      </div>

      <Modal isOpen={open} onClose={() => setOpen(false)} title={title} size="lg">
        {table && (
          <>
            <div className="dash-detail-chart">{render(420, `m${uid}`)}</div>
            <div className="dash-detail-scroll">
              <table className="dash-detail-table">
                <thead>
                  <tr>
                    <th>{labelHeader}</th>
                    {table.columns.map(c => <th key={c}>{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {table.lines.map((l, i) => (
                    <tr key={i}>
                      <td>{l.label}</td>
                      {l.values.map((v, j) => <td key={j}>{v}</td>)}
                      {l.pct !== undefined && <td>{l.pct === null ? '—' : `${l.pct} %`}</td>}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total</td>
                    {table.totals.map((t, j) => <td key={j}>{t}</td>)}
                    {series.length === 1 && <td>{table.totals[0] > 0 ? '100 %' : '—'}</td>}
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </Modal>
    </>
  )
}
