import './Toast.css'

const ICONS = {
  success: '✓',
  error:   '✕',
  warning: '!',
  info:    'i',
}

export default function Toast({ toast, onClose }) {
  if (!toast) return null

  const { message, type = 'info' } = toast

  return (
    <div className={`toast toast-${type}`} role="alert">
      <span className="toast-icon">{ICONS[type] ?? 'i'}</span>
      <span className="toast-message">{message}</span>
      <button className="toast-close" onClick={onClose} type="button">✕</button>
    </div>
  )
}
