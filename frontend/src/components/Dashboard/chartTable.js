// Tableau de détail d'un graphique : mêmes lignes que le graphique, % seulement pour une série unique.
export function buildChartTable(rows, labelKey, series) {
  const single = series.length === 1
  const totals = series.map(s => rows.reduce((sum, r) => sum + (Number(r[s.key]) || 0), 0))
  const lines = rows.map(r => {
    const values = series.map(s => Number(r[s.key]) || 0)
    return {
      label: r[labelKey],
      values,
      pct: single ? (totals[0] > 0 ? Math.round(values[0] / totals[0] * 100) : null) : undefined,
    }
  })
  return { columns: [...series.map(s => s.label), ...(single ? ['%'] : [])], lines, totals }
}
