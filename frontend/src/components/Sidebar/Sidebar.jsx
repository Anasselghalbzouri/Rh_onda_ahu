import { NavLink } from 'react-router-dom'
import './Sidebar.css'

const MENU_BY_ROLE = {
  rh: [
    { key: 'dashboard', label: 'Tableau de bord', path: '/dashboard' },
    { key: 'personnel', label: 'Personnel', path: '/personnel' },
{ key: 'conges', label: 'Congés', path: '/conges' },
    { key: 'absences', label: 'Absences', path: '/absences' },
    { key: 'avances', label: 'Avances', path: '/avances' },
  ],
  dg: [
    { key: 'dashboard', label: 'Tableau de bord', path: '/dashboard' },
    { key: 'personnel', label: 'Personnel', path: '/personnel' },
  ],
  employe: [
    { key: 'profil', label: 'Mon profil', path: '/profil' },
    { key: 'conges', label: 'Mes congés', path: '/conges' },
    { key: 'absences', label: 'Mes absences', path: '/absences' },
  ],
}

export default function Sidebar({ role }) {
  const items = MENU_BY_ROLE[role] ?? MENU_BY_ROLE.rh

  return (
    <nav className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-brand-main">RH</span>
        <span className="sidebar-brand-sep"> · </span>
        <span className="sidebar-brand-sub">ONDA</span>
      </div>

      <ul className="sidebar-menu">
        {items.map((item) => (
          <li key={item.key} className="sidebar-menu-item">
            <NavLink
              to={item.path}
              className={({ isActive }) => isActive ? 'sidebar-link active' : 'sidebar-link'}
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
