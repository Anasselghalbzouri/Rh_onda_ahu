import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../api'
import DocumentsEmployesPage from './DocumentsEmployesPage'

vi.mock('../../api', () => ({ default: { get: vi.fn() } }))

const employe = { id: 7, matricule: '90007', nom: 'BENNANI', prenom: 'Fatima' }

const LIGNES = [
  { id: 1, employe, nom_original: 'cin.pdf', categorie: 'CIN', statut: 'valide' },
  { id: 2, employe, nom_original: 'photo.png', categorie: 'Photo', statut: 'valide' },
  { id: 3, employe, nom_original: 'contrat.docx', categorie: 'Contrat', statut: 'valide' },
  { id: null, employe, nom_original: null, categorie: 'Diplôme', statut: 'manquant' },
  { id: 9, employe, nom_original: 'perdu.pdf', categorie: 'CIN', statut: 'valide' },
]

const TYPES = {
  1: 'application/pdf',
  2: 'image/png',
  3: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

async function ouvrirLigne(index) {
  render(<MemoryRouter><DocumentsEmployesPage /></MemoryRouter>)
  const boutons = await screen.findAllByRole('button', { name: /Fatima BENNANI/ })
  fireEvent.click(boutons[index])
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:apercu')
  URL.revokeObjectURL = vi.fn()
  api.get.mockImplementation((url) => {
    if (url === '/documents-employes') {
      return Promise.resolve({ data: { data: LIGNES, meta: { total: LIGNES.length, page: 1 } } })
    }
    const id = url.match(/pieces-jointes\/(\d+)\/download/)?.[1]
    return id === '9'
      ? Promise.reject(new Error('introuvable'))
      : Promise.resolve({ data: new Blob(['x'], { type: TYPES[id] }) })
  })
})

afterEach(() => vi.clearAllMocks())

describe('aperçu des documents employés', () => {
  it('affiche un PDF dans le popup au clic sur l’employé', async () => {
    await ouvrirLigne(0)
    const cadre = await screen.findByTitle('cin.pdf')
    expect(cadre.tagName).toBe('IFRAME')
    expect(cadre.getAttribute('src')).toBe('blob:apercu')
  })

  it('affiche une image', async () => {
    await ouvrirLigne(1)
    expect((await screen.findByAltText('photo.png')).tagName).toBe('IMG')
  })

  it('propose le téléchargement pour un format non affichable', async () => {
    await ouvrirLigne(2)
    expect(await screen.findByText(/aperçu n'est pas disponible/)).toBeTruthy()
  })

  it('signale un document manquant sans appeler le téléchargement', async () => {
    await ouvrirLigne(3)
    expect(screen.getByText(/pas encore été ajouté/)).toBeTruthy()
    expect(api.get.mock.calls.some(([url]) => url.includes('/download'))).toBe(false)
  })

  it('affiche une erreur si le fichier ne peut pas être récupéré', async () => {
    await ouvrirLigne(4)
    expect(await screen.findByText("Impossible d'afficher le document.")).toBeTruthy()
  })

  it('libère le fichier à la fermeture du popup', async () => {
    await ouvrirLigne(0)
    await screen.findByTitle('cin.pdf')
    fireEvent.click(screen.getByRole('button', { name: '✕' }))
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:apercu')
  })
})
