import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../api'
import FicheEmploye from './FicheEmploye'

vi.mock('../../api', () => ({ default: { get: vi.fn(), delete: vi.fn() } }))
vi.mock('../../useAuth', () => ({ useAuth: () => ({ user: { role: 'rh' } }) }))

const EMPLOYE = {
  id: 7,
  matricule: '90007',
  nom: 'BENNANI',
  prenom: 'Fatima',
  statut: 'actif',
  demandes_conge: [{ id: 3, type_conge: 'maladie', date_debut: '2026-01-05', date_fin: '2026-01-07', fichier_nom: 'certificat.pdf' }],
}

const PIECES = [{ id: 1, nom_original: 'cin.pdf', extension: 'pdf', categorie: 'CIN', statut: 'valide' }]

async function ouvrirOngletDocuments() {
  render(<MemoryRouter><FicheEmploye id={7} masquerRetour /></MemoryRouter>)
  fireEvent.click(await screen.findByRole('tab', { name: /Documents/ }))
}

beforeEach(() => {
  vi.clearAllMocks()
  URL.createObjectURL = vi.fn(() => 'blob:apercu')
  URL.revokeObjectURL = vi.fn()
  api.get.mockImplementation((url) => {
    if (url === '/employes/7') return Promise.resolve({ data: EMPLOYE })
    if (url === '/employes/7/pieces-jointes') return Promise.resolve({ data: PIECES })
    if (url.endsWith('/download') || url.endsWith('/fichier')) {
      return Promise.resolve({ data: new Blob(['x'], { type: 'application/pdf' }) })
    }
    return Promise.resolve({ data: [] })
  })
})

describe('aperçu des documents de la fiche employé', () => {
  it('affiche une pièce jointe dans le popup', async () => {
    await ouvrirOngletDocuments()
    fireEvent.click(await screen.findByRole('button', { name: 'cin.pdf' }))
    expect((await screen.findByTitle('cin.pdf')).tagName).toBe('IFRAME')
    expect(api.get).toHaveBeenCalledWith('/pieces-jointes/1/download', { responseType: 'blob' })
  })

  it('affiche le document d’un congé avec le jeton de session', async () => {
    await ouvrirOngletDocuments()
    fireEvent.click(await screen.findByRole('button', { name: 'certificat.pdf' }))
    expect((await screen.findByTitle('certificat.pdf')).tagName).toBe('IFRAME')
    expect(api.get).toHaveBeenCalledWith('/conges/3/fichier', { responseType: 'blob' })
  })

  it('ne rouvre pas le popup en cliquant sur Supprimer', async () => {
    api.delete.mockResolvedValue({})
    await ouvrirOngletDocuments()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const ligne = (await screen.findByRole('button', { name: 'cin.pdf' })).closest('tr')
    fireEvent.click(within(ligne).getByRole('button', { name: 'Supprimer' }))
    expect(screen.queryByText('Chargement du document...')).toBeNull()
    expect(api.get).not.toHaveBeenCalledWith('/pieces-jointes/1/download', { responseType: 'blob' })
  })
})
