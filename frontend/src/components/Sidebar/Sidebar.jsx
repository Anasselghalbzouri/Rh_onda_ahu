import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, Calendar, UserCircle,
  BarChart3, GraduationCap, FileSpreadsheet, FileCheck2,
} from 'lucide-react'
import './Sidebar.css'

const ICONS = {
  dashboard: LayoutDashboard,
  personnel: Users,
  conges:    Calendar,
  formations: GraduationCap,
  'mes-formations': GraduationCap,
  'documents-employes': FileCheck2,
  profil:    UserCircle,
  stats:     BarChart3,
  'rapport-activite': FileSpreadsheet,
}

const MENU_BY_ROLE = {
  rh: [
    { key: 'dashboard', label: 'Tableau de bord', path: '/dashboard' },
    { key: 'personnel', label: 'Personnel',        path: '/personnel' },
    { key: 'conges',    label: 'Congés',            path: '/conges'   },
    { key: 'formations', label: 'Formations',       path: '/formations' },
    { key: 'rapport-activite', label: 'Rapport PS09', path: '/rapport-activite' },
    { key: 'documents-employes', label: 'Documents employés', path: '/documents-employes' },
  ],
  dg: [
    { key: 'dashboard', label: 'Tableau de bord', path: '/dashboard' },
    { key: 'personnel', label: 'Personnel',        path: '/personnel' },
    { key: 'documents-employes', label: 'Documents employés', path: '/documents-employes' },
  ],
  employe: [
    { key: 'profil',    label: 'Mon profil',   path: '/profil'   },
    { key: 'conges',    label: 'Mes congés',   path: '/conges'   },
    { key: 'mes-formations', label: 'Mes formations', path: '/mes-formations' },
  ],
}

export default function Sidebar({ role }) {
  const items = MENU_BY_ROLE[role] ?? MENU_BY_ROLE.rh

  return (
    <nav className="sidebar" aria-label="Navigation principale">
      <div className="sidebar-brand">
        <img src="/airports_morocco_logo.png" alt="Airports of Morocco" className="sidebar-brand-logo" />
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
                title={item.label}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            </li>
          )
        })}
      </ul>


    </nav>
  )
}
