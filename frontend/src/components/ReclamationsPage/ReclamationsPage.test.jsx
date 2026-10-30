import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../api'
import ReclamationsPage from './ReclamationsPage'

vi.mock('../../api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

const session = vi.hoisted(() => ({ role: 'rh' }))
vi.mock('../../useAuth', () => ({ useAuth: () => ({ user: { role: session.role } }) }))

const OPTIONS = {
  etats: [
    { key: 'nouvelle', label: 'Nouvelle' },
    { key: 'en_cours', label: 'En cours' },
    { key: 'resolue', label: 'Résolue' },
  ],
}

const RECLAMATION = {
  id: 5,
  numero: '001/2026',
  date_reception: '2026-03-09',
  matricule: '000777',
  nom_complet: 'ALAMI Sara',
  type: 'Prime de formation',
  description: 'Solde de congé erroné',
  canal: 'Fiche de réclamation',
  date_reponse_1: '2026-03-10',
  contenu_reponse_1: 'Dossier transmis',
  date_reponse_2: null,
  contenu_reponse_2: null,
  date_solution: null,
  etat: 'en_cours',
  remarques: null,
}

const page = (data = [RECLAMATION]) => ({
  data: { data, current_page: 1, last_page: 1, total: data.length, options: OPTIONS },
})

// Réponse de /reclamations ; remplaçable test par test.
let liste

function appelsListe() {
  return api.get.mock.calls.filter(([url]) => url === '/reclamations')
}

function champ(nom) {
  return document.querySelector(`[name="${nom}"]`)
}

function saisir(nom, valeur) {
  fireEvent.change(champ(nom), { target: { name: nom, value: valeur } })
}

function erreur422(errors) {
  return Promise.reject({ response: { status: 422, data: { errors } } })
}

beforeEach(() => {
  session.role = 'rh'
  liste = () => Promise.resolve(page())
  api.get.mockImplementation((url) => {
    if (url === '/reclamations') return liste()
    if (url === '/employes') {
      return Promise.resolve({ data: { data: [{ id: 9, matricule: '000888', nom: 'ZIANI', prenom: 'Ali' }] } })
    }
    return Promise.reject(new Error(`inattendu : ${url}`))
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  api.get.mockReset()
  api.post.mockReset()
  api.put.mockReset()
  api.delete.mockReset()
})

describe('tableau', () => {
  it('affiche les 14 colonnes dans l\'ordre, avec libellés et dates françaises', async () => {
    render(<ReclamationsPage />)
    await screen.findByText('ALAMI Sara')

    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Numéro réclamation', 'Date de réception', 'Mle', 'Nom & Prénom', 'Type de réclamation',
      'Description de la réclamation', 'Canal utilisé par le réclamant', 'Date 1ère réponse',
      'Contenu 1ère réponse apportée', 'Date 2ème réponse', 'Contenu 2ème réponse apportée',
      'Date de solution définitive', 'État de réclamation', 'Autres remarques',
    ])
    expect(screen.getByRole('cell', { name: '09/03/2026' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Prime de formation' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Fiche de réclamation' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'En cours' })).toBeInTheDocument()
  })

  it('indique qu\'il n\'y a aucune réclamation et garde le bouton de création', async () => {
    liste = () => Promise.resolve(page([]))
    render(<ReclamationsPage />)

    expect(await screen.findByText('Aucune réclamation enregistrée.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nouvelle réclamation' })).toBeInTheDocument()
  })

  it('signale un échec de chargement et permet de réessayer', async () => {
    liste = () => Promise.reject(new Error('réseau'))
    render(<ReclamationsPage />)

    await screen.findByText('Impossible de charger les réclamations.')
    liste = () => Promise.resolve(page())
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByText('ALAMI Sara')).toBeInTheDocument()
  })
})

describe('création', () => {
  async function ouvrirCreation() {
    render(<ReclamationsPage />)
    await screen.findByText('ALAMI Sara')
    fireEvent.click(screen.getByRole('button', { name: 'Nouvelle réclamation' }))
  }

  async function choisirEmploye() {
    fireEvent.change(screen.getByPlaceholderText('Rechercher par nom ou matricule...'), { target: { value: 'zia' } })
    fireEvent.click(await screen.findByRole('button', { name: 'ZIANI Ali — 000888' }))
  }

  it('cherche un employé et envoie la réclamation', async () => {
    api.post.mockResolvedValue({ data: {} })
    await ouvrirCreation()
    await choisirEmploye()
    saisir('date_reception', '2026-03-09')
    expect(champ('type').tagName).toBe('INPUT')
    expect(champ('canal').tagName).toBe('INPUT')
    saisir('type', 'Prime de formation')
    saisir('canal', 'Fiche de réclamation')
    saisir('description', 'Solde erroné')
    const appels = appelsListe().length

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/reclamations', {
      employe_id: 9,
      date_reception: '2026-03-09',
      type: 'Prime de formation',
      canal: 'Fiche de réclamation',
      description: 'Solde erroné',
      remarques: '',
    }))
    await waitFor(() => expect(appelsListe().length).toBeGreaterThan(appels))
    expect(champ('description')).toBeNull()
  })

  it('affiche les erreurs du serveur et garde le formulaire', async () => {
    api.post.mockImplementation(() => erreur422({
      employe_id: ['Choisissez un employé.'],
      description: ['La description est obligatoire.'],
    }))
    await ouvrirCreation()
    saisir('remarques', 'à garder')

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText('Choisissez un employé.')).toBeInTheDocument()
    expect(screen.getByText('La description est obligatoire.')).toBeInTheDocument()
    expect(champ('remarques').value).toBe('à garder')
  })
})

describe('suivi', () => {
  async function ouvrirFiche() {
    render(<ReclamationsPage />)
    fireEvent.click(await screen.findByRole('button', { name: '001/2026' }))
  }

  it('ouvre le formulaire pré-rempli sans permettre de changer le numéro', async () => {
    await ouvrirFiche()

    expect(champ('contenu_reponse_1').value).toBe('Dossier transmis')
    expect(champ('etat').value).toBe('en_cours')
    expect(champ('date_reponse_2').value).toBe('')
    expect(champ('numero')).toBeNull()
    expect(screen.getByRole('heading', { name: /001\/2026/ })).toBeInTheDocument()
  })

  it('enregistre le suivi puis recharge le tableau', async () => {
    api.put.mockResolvedValue({ data: {} })
    await ouvrirFiche()
    saisir('etat', 'resolue')
    saisir('date_solution', '2026-03-12')
    const appels = appelsListe().length

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/reclamations/5', {
      date_reception: '2026-03-09',
      type: 'Prime de formation',
      canal: 'Fiche de réclamation',
      description: 'Solde de congé erroné',
      date_reponse_1: '2026-03-10',
      contenu_reponse_1: 'Dossier transmis',
      date_reponse_2: '',
      contenu_reponse_2: '',
      date_solution: '2026-03-12',
      etat: 'resolue',
      remarques: '',
    }))
    await waitFor(() => expect(appelsListe().length).toBeGreaterThan(appels))
  })

  it('affiche le refus du serveur', async () => {
    api.put.mockImplementation(() => erreur422({
      date_solution: ['La date de solution est obligatoire pour une réclamation résolue ou rejetée.'],
    }))
    await ouvrirFiche()

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText('La date de solution est obligatoire pour une réclamation résolue ou rejetée.')).toBeInTheDocument()
  })

  it('ne supprime qu\'après confirmation', async () => {
    api.delete.mockResolvedValue({ data: {} })
    const confirmer = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await ouvrirFiche()

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect(api.delete).not.toHaveBeenCalled()

    confirmer.mockReturnValue(true)
    const appels = appelsListe().length
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer' }))

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/reclamations/5'))
    await waitFor(() => expect(appelsListe().length).toBeGreaterThan(appels))
  })

  it('donne au DG une lecture seule du texte complet', async () => {
    session.role = 'dg'
    render(<ReclamationsPage />)
    await screen.findByText('ALAMI Sara')

    expect(screen.queryByRole('button', { name: 'Nouvelle réclamation' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '001/2026' }))

    const fiche = screen.getByRole('heading', { name: /001\/2026/ }).closest('.modal-box')
    expect(within(fiche).getByText('Solde de congé erroné')).toBeInTheDocument()
    expect(within(fiche).getByText('Dossier transmis')).toBeInTheDocument()
    expect(fiche.querySelector('input, select, textarea')).toBeNull()
    expect(within(fiche).queryByRole('button', { name: 'Enregistrer' })).not.toBeInTheDocument()
    expect(within(fiche).queryByRole('button', { name: 'Supprimer' })).not.toBeInTheDocument()
  })
})

describe('export Excel', () => {
  beforeEach(() => {
    window.URL.createObjectURL = vi.fn(() => 'blob:test')
    window.URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    api.get.mockImplementation((url) => {
      if (url === '/reclamations') return liste()
      if (url === '/reclamations/export') return Promise.resolve({ data: new ArrayBuffer(1) })
      return Promise.reject(new Error(`inattendu : ${url}`))
    })
  })

  it('télécharge le fichier avec les filtres en cours, y compris pour le DG', async () => {
    session.role = 'dg'
    render(<ReclamationsPage />)
    await screen.findByText('ALAMI Sara')
    fireEvent.change(screen.getByLabelText('État'), { target: { value: 'en_cours' } })
    await screen.findByText('ALAMI Sara')

    fireEvent.click(screen.getByRole('button', { name: 'Exporter Excel' }))

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/reclamations/export', {
      params: { search: '', etat: 'en_cours' },
      responseType: 'blob',
    }))
    await waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled())
  })

  it('est désactivé sans réclamation', async () => {
    liste = () => Promise.resolve(page([]))
    render(<ReclamationsPage />)
    await screen.findByText('Aucune réclamation enregistrée.')

    expect(screen.getByRole('button', { name: 'Exporter Excel' })).toBeDisabled()
  })

  it('signale un échec', async () => {
    render(<ReclamationsPage />)
    await screen.findByText('ALAMI Sara')
    api.get.mockImplementationOnce(() => Promise.reject(new Error('réseau')))

    fireEvent.click(screen.getByRole('button', { name: 'Exporter Excel' }))

    expect(await screen.findByText('Échec de l\'export. Veuillez réessayer.')).toBeInTheDocument()
  })
})

describe('recherche et filtres', () => {
  it('envoie les filtres et revient à la page 1', async () => {
    liste = () => Promise.resolve({ data: { ...page().data, last_page: 2 } })
    render(<ReclamationsPage />)
    await screen.findByText('ALAMI Sara')

    fireEvent.click(screen.getByRole('button', { name: 'Suivant →' }))
    await waitFor(() => expect(appelsListe().at(-1)[1].params.page).toBe(2))

    fireEvent.change(screen.getByLabelText('État'), { target: { value: 'en_cours' } })
    await waitFor(() => expect(appelsListe().at(-1)[1].params).toEqual({ page: 1, search: '', etat: 'en_cours' }))

    fireEvent.change(screen.getByPlaceholderText('Numéro, matricule, nom ou type...'), { target: { value: '000777' } })
    await waitFor(() => expect(appelsListe().at(-1)[1].params).toEqual({ page: 1, search: '000777', etat: 'en_cours' }))
  })

  it('distingue l\'absence de résultat', async () => {
    render(<ReclamationsPage />)
    await screen.findByText('ALAMI Sara')

    liste = () => Promise.resolve(page([]))
    fireEvent.change(screen.getByLabelText('État'), { target: { value: 'resolue' } })

    expect(await screen.findByText('Aucune réclamation ne correspond à votre recherche.')).toBeInTheDocument()
  })

  it('ignore la réponse tardive d\'un ancien filtre', async () => {
    render(<ReclamationsPage />)
    await screen.findByText('ALAMI Sara')

    let resoudreAncien
    liste = () => new Promise((resolve) => { resoudreAncien = resolve })
    fireEvent.change(screen.getByLabelText('État'), { target: { value: 'en_cours' } })

    liste = () => Promise.resolve(page([{ ...RECLAMATION, nom_complet: 'RECENTE Lina' }]))
    fireEvent.change(screen.getByLabelText('État'), { target: { value: 'resolue' } })
    await screen.findByText('RECENTE Lina')

    resoudreAncien(page([{ ...RECLAMATION, nom_complet: 'ANCIENNE Hind' }]))
    await new Promise((resolve) => setTimeout(resolve))

    expect(screen.queryByText('ANCIENNE Hind')).not.toBeInTheDocument()
    expect(screen.getByText('RECENTE Lina')).toBeInTheDocument()
  })
})
