import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, Calendar, FolderOpen, UserCircle,
  CalendarCheck, BarChart3,
} from 'lucide-react'
import './Sidebar.css'

const ICONS = {
  dashboard: LayoutDashboard,
  personnel: Users,
  conges:    Calendar,
  absences:  CalendarCheck,
  avances:   FolderOpen,
  profil:    UserCircle,
  stats:     BarChart3,
}

const MENU_BY_ROLE = {
  rh: [
    { key: 'dashboard', label: 'Tableau de bord', path: '/dashboard' },
    { key: 'personnel', label: 'Personnel',        path: '/personnel' },
    { key: 'conges',    label: 'Congés',            path: '/conges'   },
    { key: 'absences',  label: 'Absences',          path: '/absences' },
    { key: 'avances',   label: 'Avances',           path: '/avances'  },
  ],
  dg: [
    { key: 'dashboard', label: 'Tableau de bord', path: '/dashboard' },
    { key: 'personnel', label: 'Personnel',        path: '/personnel' },
  ],
  employe: [
    { key: 'profil',    label: 'Mon profil',   path: '/profil'   },
    { key: 'conges',    label: 'Mes congés',   path: '/conges'   },
    { key: 'absences',  label: 'Mes absences', path: '/absences' },
  ],
}

export default function Sidebar({ role }) {
  const items = MENU_BY_ROLE[role] ?? MENU_BY_ROLE.rh

  return (
    <nav className="sidebar" aria-label="Navigation principale">
      <div className="sidebar-brand">
        <div className="sidebar-brand-logo" aria-hidden="true">RH</div>
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-main">RH ONDA</span>
          <span className="sidebar-brand-sub">Aéroport AHU</span>
        </div>
      </div>

      <p className="sidebar-nav-label">Menu</p>

      <ul className="sidebar-menu">
        {items.map((item) => {
          const Icon = ICONS[item.key] ?? LayoutDashboard
          return (
            <li key={item.key} className="sidebar-menu-item">
              <NavLink
                to={item.path}
                className={({ isActive }) => isActive ? 'sidebar-link active' : 'sidebar-link'}
              >
                <Icon size={18} aria-hidden="true" />
                {item.label}
              </NavLink>
            </li>
          )
        })}
      </ul>

      <div className="sidebar-footer">
        <p className="sidebar-version">RH ONDA v1.0</p>
      </div>
    </nav>
  )
}
