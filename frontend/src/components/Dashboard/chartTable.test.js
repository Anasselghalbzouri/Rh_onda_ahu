import { describe, it, expect } from 'vitest'
import { buildChartTable } from './chartTable'

describe('buildChartTable', () => {
  it('une série : % arrondis et somme = total', () => {
    const t = buildChartTable(
      [{ name: 'A', total: 1 }, { name: 'B', total: 2 }],
      'name', [{ key: 'total', label: 'Employés' }],
    )
    expect(t.columns).toEqual(['Employés', '%'])
    expect(t.lines.map(l => l.pct)).toEqual([33, 67])
    expect(t.totals).toEqual([3])
    expect(t.lines.reduce((s, l) => s + l.values[0], 0)).toBe(t.totals[0])
  })

  it('total 0 : pct null', () => {
    const t = buildChartTable([{ name: 'A', total: 0 }], 'name', [{ key: 'total', label: 'X' }])
    expect(t.lines[0].pct).toBeNull()
  })

  it('deux séries : pas de %, un total par série, valeur absente = 0', () => {
    const t = buildChartTable(
      [{ tranche: '20-29', hommes: 3, femmes: 2 }, { tranche: '30-39', hommes: 1 }],
      'tranche', [{ key: 'hommes', label: 'Hommes' }, { key: 'femmes', label: 'Femmes' }],
    )
    expect(t.columns).toEqual(['Hommes', 'Femmes'])
    expect(t.lines[0].pct).toBeUndefined()
    expect(t.lines[1].values).toEqual([1, 0])
    expect(t.totals).toEqual([4, 2])
  })
})
