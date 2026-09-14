import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { FileSpreadsheet, Download, UploadCloud } from 'lucide-react'
import Modal from '../Modal/Modal'
import './ImportExcelModal.css'

const DIACRITICS_RE = new RegExp('[\\u0300-\\u036f]', 'g')

const normalizeHeader = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(DIACRITICS_RE, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

const pad2 = (value) => String(value).padStart(2, '0')

// Convertit une cellule date Excel (objet Date, numéro de série, ou texte
// d/m/Y) en YYYY-MM-DD, format accepté par la règle Laravel `date`.
const toIsoDate = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed) return `${parsed.y}-${pad2(parsed.m)}-${pad2(parsed.d)}`
  }

  const text = String(value ?? '').trim()
  const match = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(text)
  if (match) {
    const [, day, month, rawYear] = match
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear
    return `${year}-${pad2(month)}-${pad2(day)}`
  }

  return text
}

// Normalise une cellule selon le contrat du champ : texte, date ou nombre.
// Les cellules optionnelles vides restent des chaînes vides.
const normalizeCell = (value, type) => {
  if (value === null || value === undefined) return ''
  if (type === 'date') return toIsoDate(value)
  if (value instanceof Date) return toIsoDate(value)
  if (type === 'number') {
    return typeof value === 'number' && Number.isFinite(value)
      ? String(value)
      : String(value).trim()
  }
  return String(value).trim()
}

// Rend lisible une clé d'erreur Laravel `employes.{index}.{field}`.
const formatFieldError = (key, message) => {
  const match = /^employes\.(\d+)\.(.+)$/.exec(key)
  if (!match) return `${key} : ${message}`
  return `Ligne ${Number(match[1]) + 1} · ${match[2]} : ${message}`
}

/**
 * Generic "import from Excel" modal.
 *
 * fields: [{ key, label, required }] — key is the API field name, label is the
 * expected column header in the Excel sheet (matched case/accent-insensitively).
 * onImport(rows) must call the API and return the response payload (or throw).
 */
export default function ImportExcelModal({
  isOpen,
  onClose,
  title = 'Importer depuis Excel',
  description,
  fields,
  templateFilename = 'modele-import.xlsx',
  onImport,
}) {
  const fileInputRef = useRef(null)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState([])
  const [parseError, setParseError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [submitError, setSubmitError] = useState(null)

  const fieldByHeader = new Map(
    fields.map((f) => [normalizeHeader(f.label ?? f.key), f])
  )

  const reset = () => {
    setFileName('')
    setRows([])
    setParseError(null)
    setResult(null)
    setSubmitError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setParseError(null)
    setResult(null)
    setSubmitError(null)

    try {
      const buffer = await file.arrayBuffer()
      // cellDates: les cellules date Excel deviennent des objets Date au lieu
      // de numéros de série, ce qui évite d'envoyer "45678" à Laravel.
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' })

      if (raw.length === 0) {
        setParseError('Le fichier ne contient aucune ligne de données.')
        setRows([])
        return
      }

      const mapped = raw.map((rawRow) => {
        const row = {}
        for (const [header, value] of Object.entries(rawRow)) {
          const field = fieldByHeader.get(normalizeHeader(header))
          if (field) {
            // Excel peut typer n'importe quelle cellule comme un nombre. On
            // normalise selon le contrat du champ : texte en chaîne, dates en
            // YYYY-MM-DD, solde numérique en chaîne numérique. Laravel reste
            // la source de validation.
            row[field.key] = normalizeCell(value, field.type)
          }
        }
        return row
      })

      const requiredKeys = fields.filter((f) => f.required).map((f) => f.key)
      const missing = requiredKeys.filter((key) => !mapped.some((row) => row[key] !== undefined))
      if (missing.length > 0) {
        const labels = fields.filter((f) => missing.includes(f.key)).map((f) => f.label)
        setParseError(`Colonnes obligatoires introuvables dans le fichier : ${labels.join(', ')}`)
        setRows([])
        return
      }

      setRows(mapped)
    } catch {
      setParseError("Impossible de lire ce fichier. Vérifiez qu'il s'agit bien d'un fichier Excel (.xlsx).")
      setRows([])
    }
  }

  const downloadTemplate = () => {
    const headerRow = fields.map((f) => f.label)
    const worksheet = XLSX.utils.aoa_to_sheet([headerRow])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Modèle')
    XLSX.writeFile(workbook, templateFilename)
  }

  const handleSubmit = async () => {
    if (rows.length === 0) return
    setSubmitting(true)
    setSubmitError(null)
    setResult(null)
    try {
      const data = await onImport(rows)
      setResult(data)
    } catch (err) {
      const errors = err?.response?.data?.errors
      if (errors) {
        const flat = Object.entries(errors).flatMap(([key, messages]) =>
          (Array.isArray(messages) ? messages : [messages]).map((message) =>
            formatFieldError(key, message)
          )
        )
        setSubmitError(flat.slice(0, 5).join(' — '))
      } else {
        setSubmitError("Échec de la synchronisation. Vérifiez le fichier et réessayez.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} size="md">
      <div className="import-excel-body">
        {description && <p className="import-excel-desc">{description}</p>}

        <button type="button" className="import-excel-template-btn" onClick={downloadTemplate}>
          <Download size={14} aria-hidden="true" />
          Télécharger le modèle Excel
        </button>

        <label className="import-excel-dropzone" htmlFor="import-excel-file">
          <UploadCloud size={22} aria-hidden="true" />
          <span>{fileName || 'Choisir un fichier .xlsx à importer'}</span>
          <input
            id="import-excel-file"
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFile}
            hidden
          />
        </label>

        {parseError && <div className="import-excel-error">{parseError}</div>}

        {rows.length > 0 && !parseError && (
          <div className="import-excel-preview">
            <FileSpreadsheet size={16} aria-hidden="true" />
            <span>{rows.length} ligne(s) prête(s) à synchroniser</span>
          </div>
        )}

        {submitError && <div className="import-excel-error">{submitError}</div>}

        {result && (
          <div className="import-excel-result">
            {Object.entries(result)
              .filter(([key]) => key !== 'results')
              .map(([key, value]) => (
                <span key={key} className="import-excel-result-chip">
                  {key} : <strong>{String(value)}</strong>
                </span>
              ))}
          </div>
        )}

        <div className="import-excel-actions">
          <button type="button" className="import-excel-cancel-btn" onClick={handleClose} disabled={submitting}>
            Fermer
          </button>
          <button
            type="button"
            className="import-excel-submit-btn"
            onClick={handleSubmit}
            disabled={rows.length === 0 || submitting}
          >
            {submitting ? 'Synchronisation...' : 'Synchroniser'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
