import { useEffect, useState } from 'react'
import api from '../../api'
import './DocumentsEmployesPage.css'

/** Affiche un fichier récupéré en flux authentifié (pas d'URL publique). */
export default function ApercuDocument({ route, nom }) {
  const [apercu, setApercu] = useState(null)

  useEffect(() => {
    let annule = false
    let url = null
    api.get(route, { responseType: 'blob' })
      .then(({ data }) => {
        if (annule) return
        url = URL.createObjectURL(data)
        setApercu({ url, type: data.type })
      })
      .catch(() => { if (!annule) setApercu({ erreur: true }) })
    return () => {
      annule = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [route])

  if (!apercu) return <div className="de-apercu-message">Chargement du document...</div>
  if (apercu.erreur) return <div className="de-form-error">Impossible d'afficher le document.</div>
  if (apercu.type === 'application/pdf') {
    return <iframe className="de-apercu-cadre" src={apercu.url} title={nom} />
  }
  if (apercu.type.startsWith('image/')) {
    return <img className="de-apercu-image" src={apercu.url} alt={nom} />
  }
  return (
    <div className="de-apercu-message">
      L'aperçu n'est pas disponible pour ce format. Téléchargez le fichier pour l'ouvrir.
    </div>
  )
}
