import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../api'
import RapportEmployesPage from './RapportEmployesPage'

vi.mock('../../api', () => ({ default: { get: vi.fn() } }))

const COLONNES = [
  { key: 'matricule', label: 'Matricule' },
  { key: 'nom', label: 'Nom' },
  { key: 'prenom', label: 'Prénom' },
  { key: 'statut', label: 'Statut' },
  { key: 'solde_conge', label: 'Solde congé (j)' },
]

const SERVICES = [{ id: 3, nom: 'Sûreté' }]

// Réponse de /rapport-employes par défaut ; remplaçable test par test.
let apercu

function appelsApercu() {
  return api.get.mock.calls.filter(([url]) => url === '/rapport-employes')
}

function boutonExporter() {
  return screen.getByRole('button', { name: 'Exporter' })
}

function changerService(valeur) {
  fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: valeur } })
}

async function ouvrirPage() {
  render(<RapportEmployesPage />)
  await screen.findByRole('checkbox', { name: 'Nom' })
}

beforeEach(() => {
  apercu = () => Promise.resolve({ data: { total: 3, filtres: {}, colonnes: COLONNES } })
  api.get.mockImplementation((url, config) => {
    if (url === '/services') return Promise.resolve({ data: SERVICES })
    if (url === '/rapport-employes') return apercu(config.params)
    return Promise.resolve({ data: new ArrayBuffer(1) })
  })
  window.URL.createObjectURL = vi.fn(() => 'blob:test')
  window.URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  api.get.mockReset()
})

describe('choix des colonnes', () => {
  it('coche seulement Matricule, Nom et Prénom à l\'ouverture', async () => {
    await ouvrirPage()

    expect(screen.getByRole('checkbox', { name: 'Matricule' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Nom' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Prénom' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Statut' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Solde congé (j)' })).not.toBeChecked()
  })

  it('tout cocher puis tout décocher', async () => {
    await ouvrirPage()

    fireEvent.click(screen.getByRole('button', { name: 'Tout cocher' }))
    screen.getAllByRole('checkbox').forEach((c) => expect(c).toBeChecked())

    fireEvent.click(screen.getByRole('button', { name: 'Tout décocher' }))
    screen.getAllByRole('checkbox').forEach((c) => expect(c).not.toBeChecked())
  })

  it('exporte les colonnes cochées avec les filtres', async () => {
    await ouvrirPage()
    await screen.findByRole('option', { name: 'Sûreté' })
    changerService('3')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Matricule' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Prénom' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Statut' }))
    await waitFor(() => expect(boutonExporter()).toBeEnabled())

    fireEvent.click(boutonExporter())

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/rapport-employes/export', {
      params: { service_id: '3', colonnes: ['nom', 'statut'] },
      responseType: 'blob',
    }))
  })
})

describe('aperçu du fichier', () => {
  it('affiche les employés avec seulement les colonnes cochées', async () => {
    apercu = (params) => Promise.resolve({
      data: {
        total: 1,
        filtres: {},
        colonnes: COLONNES,
        lignes: [params.colonnes.includes('statut')
          ? { matricule: '000777', nom: 'ALAMI', prenom: 'Sara', statut: 'actif' }
          : { matricule: '000777', nom: 'ALAMI', prenom: 'Sara' }],
      },
    })
    await ouvrirPage()

    expect(await screen.findByRole('cell', { name: 'ALAMI' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '000777' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Statut' })).not.toBeInTheDocument()
    expect(screen.queryByRole('cell', { name: 'actif' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Statut' }))

    expect(screen.getByRole('columnheader', { name: 'Statut' })).toBeInTheDocument()
    expect(await screen.findByRole('cell', { name: 'actif' })).toBeInTheDocument()
    expect(appelsApercu().at(-1)[1].params.colonnes).toEqual(['matricule', 'nom', 'prenom', 'statut'])
  })

  it('recharge le total quand un filtre change', async () => {
    await ouvrirPage()
    await screen.findByText('3')
    await screen.findByRole('option', { name: 'Sûreté' })

    apercu = () => Promise.resolve({ data: { total: 7, filtres: {}, colonnes: COLONNES } })
    changerService('3')

    expect(await screen.findByText('7')).toBeInTheDocument()
  })

  it('ignore la réponse tardive d\'un ancien filtre', async () => {
    await ouvrirPage()
    await screen.findByRole('option', { name: 'Sûreté' })

    let resoudreAncien
    apercu = () => new Promise((resolve) => { resoudreAncien = resolve })
    changerService('3')

    apercu = () => Promise.resolve({ data: { total: 7, filtres: {}, colonnes: COLONNES } })
    changerService('')
    await screen.findByText('7')

    resoudreAncien({ data: { total: 99, filtres: {}, colonnes: COLONNES } })
    await new Promise((resolve) => setTimeout(resolve))

    expect(screen.queryByText('99')).not.toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('désactive l\'export pendant le chargement', async () => {
    apercu = () => new Promise(() => {})
    render(<RapportEmployesPage />)

    expect(boutonExporter()).toBeDisabled()
  })

  it('désactive l\'export sans colonne et le demande en français', async () => {
    await ouvrirPage()
    await waitFor(() => expect(boutonExporter()).toBeEnabled())

    fireEvent.click(screen.getByRole('button', { name: 'Tout décocher' }))

    expect(boutonExporter()).toBeDisabled()
    expect(screen.getByText('Choisissez au moins une colonne à exporter.')).toBeInTheDocument()
    expect(screen.queryByRole('columnheader')).not.toBeInTheDocument()
  })

  it('désactive l\'export si aucun employé ne correspond', async () => {
    apercu = () => Promise.resolve({ data: { total: 0, filtres: {}, colonnes: COLONNES } })
    await ouvrirPage()

    expect(await screen.findByText('Aucun employé ne correspond aux critères sélectionnés.')).toBeInTheDocument()
    expect(boutonExporter()).toBeDisabled()
  })

  it('désactive l\'export après un échec et permet de réessayer', async () => {
    apercu = () => Promise.reject(new Error('réseau'))
    render(<RapportEmployesPage />)

    expect(await screen.findByText('Impossible de calculer l\'aperçu pour les filtres sélectionnés.')).toBeInTheDocument()
    expect(boutonExporter()).toBeDisabled()

    apercu = () => Promise.resolve({ data: { total: 3, filtres: {}, colonnes: COLONNES } })
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    await waitFor(() => expect(boutonExporter()).toBeEnabled())
    expect(screen.queryByText('Impossible de calculer l\'aperçu pour les filtres sélectionnés.')).not.toBeInTheDocument()
  })

  it('conserve la sélection si l\'export échoue', async () => {
    await ouvrirPage()
    await waitFor(() => expect(boutonExporter()).toBeEnabled())
    fireEvent.click(screen.getByRole('checkbox', { name: 'Statut' }))
    await waitFor(() => expect(boutonExporter()).toBeEnabled())

    api.get.mockImplementationOnce(() => Promise.reject(new Error('réseau')))
    fireEvent.click(boutonExporter())

    expect(await screen.findByText('Échec de l\'export. Veuillez réessayer.')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Statut' })).toBeChecked()
  })
})

describe('solde de congé', () => {
  it('n\'est exporté que s\'il est coché', async () => {
    await ouvrirPage()
    await waitFor(() => expect(boutonExporter()).toBeEnabled())

    fireEvent.click(boutonExporter())
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/rapport-employes/export', {
      params: { colonnes: ['matricule', 'nom', 'prenom'] },
      responseType: 'blob',
    }))
    await waitFor(() => expect(boutonExporter()).toBeEnabled())

    fireEvent.click(screen.getByRole('checkbox', { name: 'Solde congé (j)' }))
    await waitFor(() => expect(boutonExporter()).toBeEnabled())
    fireEvent.click(boutonExporter())
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/rapport-employes/export', {
      params: { colonnes: ['matricule', 'nom', 'prenom', 'solde_conge'] },
      responseType: 'blob',
    }))
  })
})
