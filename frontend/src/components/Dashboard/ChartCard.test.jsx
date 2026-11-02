import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChartCard from './ChartCard'

const props = {
  title: 'Effectif par service',
  labelKey: 'name', labelHeader: 'Service',
  series: [{ key: 'total', label: 'Employés' }],
  render: (h) => <div data-testid="chart">{h}</div>,
}

describe('ChartCard', () => {
  it('ouvre la fenêtre au clavier avec le tableau, se ferme par Échap', async () => {
    const user = userEvent.setup()
    render(<ChartCard {...props} rows={[{ name: 'Exploitation', total: 3 }, { name: 'Sûreté', total: 1 }]} />)

    screen.getByRole('button', { name: 'Voir le détail : Effectif par service' }).focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('75 %')).toBeInTheDocument()
    expect(screen.getByText('Total')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('carte sans données : inerte', () => {
    render(<ChartCard {...props} rows={[]} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('Aucune donnée')).toBeInTheDocument()
  })
})
