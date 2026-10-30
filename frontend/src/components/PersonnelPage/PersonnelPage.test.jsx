import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../api'
import PersonnelPage from './PersonnelPage'

vi.mock('../../api', () => ({ default: { get: vi.fn(), put: vi.fn(), delete: vi.fn(), post: vi.fn() } }))
vi.mock('../../useAuth', () => ({ useAuth: () => ({ user: { role: 'rh' } }) }))

// Fiche simulée « en cours de modification », activée par describe ; la vraie fiche sinon.
const simulation = vi.hoisted(() => ({ ficheModifiee: false }))
vi.mock('../FicheEmploye/FicheEmploye', async (importOriginal) => {
  const { useEffect } = await import('react')
  const { default: Vraie } = await importOriginal()
  function FicheModifiee({ id, onDirtyChange, onSaved }) {
    useEffect(() => { onDirtyChange?.(true) }, [onDirtyChange])
    return (
      <div>
        <span>Fiche {id}</span>
        <button type="button" onClick={() => onSaved?.()}>Enregistrer</button>
      </div>
    )
  }
  return { default: (props) => (simulation.ficheModifiee ? <FicheModifiee {...props} /> : <Vraie {...props} />) }
})

const EMPLOYES = [
  { id: 1, matricule: '001', nom: 'ALAMI', prenom: 'Ali', fonction: 'Pompier', statut: 'actif', solde_conge: 10 },
  { id: 2, matricule: '002', nom: 'BENANI', prenom: 'Sara', fonction: 'Contrôleur', statut: 'actif', solde_conge: 10 },
]

beforeEach(() => {
  api.get.mockImplementation((url) => {
    if (url === '/employes') return Promise.resolve({ data: { data: EMPLOYES, last_page: 1, current_page: 1, total: 2 } })
    const fiche = url.match(/^\/employes\/(\d+)$/)
    if (fiche) return Promise.resolve({ data: EMPLOYES.find((e) => e.id === Number(fiche[1])) })
    return Promise.resolve({ data: [] })
  })
})

afterEach(() => vi.clearAllMocks())

const afficher = () => render(<MemoryRouter><PersonnelPage /></MemoryRouter>)
const ligne = async (prenom) => (await within(await screen.findByRole('table')).findByText(new RegExp(`${prenom} `))).closest('tr')
const panneau = () => screen.queryByRole('complementary')

describe('PersonnelPage — fiche à côté de la liste', () => {
  it('ouvre la fiche à côté sans démonter la liste ni perdre la recherche', async () => {
    afficher()
    const recherche = (await screen.findAllByRole('textbox'))[0]
    fireEvent.change(recherche, { target: { value: 'Ali' } })

    fireEvent.click(await ligne('Ali'))

    expect(await within(await screen.findByRole('complementary')).findByRole('heading', { level: 2, name: 'Ali ALAMI' })).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(recherche).toHaveValue('Ali')
    expect(await ligne('Ali')).toHaveAttribute('aria-selected', 'true')
  })

  it('change de fiche au clic sur une autre personne et se ferme avec Échap', async () => {
    afficher()
    fireEvent.click(await ligne('Ali'))
    await within(await screen.findByRole('complementary')).findByRole('heading', { level: 2, name: 'Ali ALAMI' })

    fireEvent.click(await ligne('Sara'))
    expect(await within(panneau()).findByRole('heading', { level: 2, name: 'Sara BENANI' })).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(panneau()).toBeNull())
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('affiche Profil, Congés et Documents, puis tous les onglets avec « Voir le détail »', async () => {
    afficher()
    const recherche = (await screen.findAllByRole('textbox'))[0]
    fireEvent.change(recherche, { target: { value: 'Ali' } })
    fireEvent.click(await ligne('Ali'))

    const onglets = async () => (await within(await screen.findByRole('complementary')).findAllByRole('tab')).map((t) => t.textContent)
    expect(await onglets()).toEqual(['Profil', 'Congés', 'Documents'])

    fireEvent.click(await screen.findByRole('button', { name: 'Voir le détail' }))
    expect(document.querySelector('.personnel-page--agrandi')).not.toBeNull()
    expect(await onglets()).toEqual(['Profil', 'Congés', 'Formations', 'Documents', 'Historique', 'Observations'])
    expect(recherche).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Vue résumée' }))
    expect(document.querySelector('.personnel-page--agrandi')).toBeNull()
    expect(await onglets()).toEqual(['Profil', 'Congés', 'Documents'])
    expect(recherche).toHaveValue('Ali')
  })
})

describe('PersonnelPage — modifications en cours', () => {
  beforeEach(() => { simulation.ficheModifiee = true })
  afterEach(() => { simulation.ficheModifiee = false })

  const afficherAvecFicheModifiee = async () => afficher()

  it('demande confirmation avant de quitter une fiche modifiée', async () => {
    await afficherAvecFicheModifiee()
    fireEvent.click(await ligne('Ali'))
    await within(await screen.findByRole('complementary')).findByText('Fiche 1')

    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    fireEvent.click(await ligne('Sara'))
    expect(confirm).toHaveBeenCalled()
    expect(within(panneau()).getByText('Fiche 1')).toBeInTheDocument()

    confirm.mockReturnValue(true)
    fireEvent.click(await ligne('Sara'))
    expect(await within(panneau()).findByText('Fiche 2')).toBeInTheDocument()
    confirm.mockRestore()
  })

  it('recharge la liste après un enregistrement depuis le panneau', async () => {
    await afficherAvecFicheModifiee()
    fireEvent.click(await ligne('Ali'))
    const appelsAvant = api.get.mock.calls.filter(([url]) => url === '/employes').length

    fireEvent.click(await within(await screen.findByRole('complementary')).findByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(api.get.mock.calls.filter(([url]) => url === '/employes').length).toBe(appelsAvant + 1))
  })
})
