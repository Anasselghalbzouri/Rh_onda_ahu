import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ImportExcelModal from './ImportExcelModal'
import { buildSyncConfirmation } from './syncConfirmation'

vi.mock('xlsx', () => ({
  read: vi.fn(() => ({ SheetNames: ['Feuil1'], Sheets: { Feuil1: {} } })),
  utils: {
    sheet_to_json: vi.fn(() => [
      { Matricule: '000123', Nom: 'DOE', Prenom: 'Jane' },
    ]),
  },
  SSF: { parse_date_code: vi.fn(() => null) },
}))

const FIELDS = [
  { key: 'matricule', label: 'Matricule', required: true },
  { key: 'nom', label: 'Nom', required: true },
  { key: 'prenom', label: 'Prenom', required: true },
]

const uploadWorkbook = async (container) => {
  const file = new File(['contenu'], 'employes.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const input = container.querySelector('input[type="file"]')
  fireEvent.change(input, { target: { files: [file] } })
  await screen.findByText(/ligne\(s\) prête\(s\) à synchroniser/)
}

const submitImport = async (onImport) => {
  const { container } = render(
    <ImportExcelModal
      isOpen
      onClose={() => {}}
      fields={FIELDS}
      onImport={onImport}
    />
  )

  await uploadWorkbook(container)
  fireEvent.click(screen.getByRole('button', { name: /^synchroniser$/i }))

  return container
}

describe('ImportExcelModal confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('confirms created rows after a successful sync', async () => {
    await submitImport(vi.fn().mockResolvedValue({
      total: 1,
      created: 1,
      modified: 0,
      unchanged: 0,
    }))

    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent('mise à jour')
    expect(status).toHaveTextContent('1 créé(s)')
  })

  it('confirms modified rows after a successful sync', async () => {
    await submitImport(vi.fn().mockResolvedValue({
      total: 1,
      created: 0,
      modified: 1,
      unchanged: 0,
    }))

    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent('mise à jour')
    expect(status).toHaveTextContent('1 modifié(s)')
  })

  it('states that no database change occurred when all rows are unchanged', async () => {
    await submitImport(vi.fn().mockResolvedValue({
      total: 1,
      created: 0,
      modified: 0,
      unchanged: 1,
    }))

    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent('Aucun changement en base')
    expect(status).toHaveTextContent('1 inchangé(s)')
  })

  it('keeps the error visible and shows no confirmation when the sync fails', async () => {
    const error = {
      response: {
        data: {
          errors: { 'employes.0.nom': ['Le champ nom est obligatoire.'] },
        },
      },
    }
    await submitImport(vi.fn().mockRejectedValue(error))

    await waitFor(() => {
      expect(screen.getByText(/Ligne 1 · nom/)).toBeInTheDocument()
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

describe('buildSyncConfirmation', () => {
  it('returns null for non bulk-sync result shapes', () => {
    expect(buildSyncConfirmation(null)).toBeNull()
    expect(buildSyncConfirmation({ inserted: 2, updated: 1 })).toBeNull()
  })

  it('flags a database change when rows are created or modified', () => {
    expect(buildSyncConfirmation({ created: 2, modified: 1, unchanged: 0 })).toMatchObject({
      hasChanges: true,
      created: 2,
      modified: 1,
      unchanged: 0,
    })
  })

  it('flags no change when every row is unchanged', () => {
    expect(buildSyncConfirmation({ created: 0, modified: 0, unchanged: 3 })).toMatchObject({
      hasChanges: false,
      unchanged: 3,
    })
  })
})
