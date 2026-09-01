import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, CheckCheck, FileSpreadsheet, Info } from 'lucide-react'
import api from '../../api'
import './NotificationBell.css'

const POLL_INTERVAL = 30000 // 30 s

function timeAgo(iso) {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  const diff = Math.max(0, Date.now() - then)
  const min = Math.floor(diff / 60000)
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `il y a ${h} h`
  const d = Math.floor(h / 24)
  if (d < 7) return `il y a ${d} j`
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

const ICONS = {
  sync_excel: FileSpreadsheet,
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications')
      setNotifications(data.notifications ?? [])
      setUnread(data.unread_count ?? 0)
    } catch {
      /* silencieux : le badge disparaît simplement si l'API est indisponible */
    }
  }, [])

  // Chargement initial + polling
  useEffect(() => {
    load()
    const timer = setInterval(load, POLL_INTERVAL)
    return () => clearInterval(timer)
  }, [load])

  // Fermeture au clic extérieur
  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const markAllRead = async () => {
    setUnread(0)
    setNotifications((prev) => prev.map((n) => ({ ...n, lu: true })))
    try {
      await api.post('/notifications/read-all')
    } catch {
      load() // resynchronise en cas d'échec
    }
  }

  return (
    <div className="notif-root" ref={rootRef}>
      <button
        type="button"
        className="notif-bell"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unread > 0 ? ` (${unread} non lues)` : ''}`}
        aria-expanded={open}
      >
        <Bell size={16} aria-hidden="true" />
        {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="notif-panel" role="dialog" aria-label="Notifications">
          <div className="notif-panel-head">
            <strong>Notifications</strong>
            {unread > 0 && (
              <button type="button" className="notif-markall" onClick={markAllRead}>
                <CheckCheck size={13} aria-hidden="true" />
                Tout marquer comme lu
              </button>
            )}
          </div>

          <div className="notif-list">
            {notifications.length === 0 ? (
              <div className="notif-empty">
                <Info size={18} aria-hidden="true" />
                <span>Aucune notification</span>
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = ICONS[n.type] ?? Info
                return (
                  <div key={n.id} className={`notif-item${n.lu ? '' : ' notif-item--unread'}`}>
                    <span className="notif-item-icon">
                      <Icon size={16} aria-hidden="true" />
                    </span>
                    <span className="notif-item-body">
                      <strong>{n.titre}</strong>
                      <span className="notif-item-msg">{n.message}</span>
                      <span className="notif-item-time">{timeAgo(n.created_at)}</span>
                    </span>
                    {!n.lu && <span className="notif-dot" aria-hidden="true" />}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
