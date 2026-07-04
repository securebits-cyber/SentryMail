import { LayoutDashboard, LogOut, Mail, Moon, Sun } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme'
import { logout } from '../services/auth'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/campaigns', label: 'Kampagnen', icon: Mail, end: false },
]

export default function Layout() {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="flex min-h-screen bg-bg text-text-primary">
      <aside className="flex w-56 shrink-0 flex-col justify-between border-r border-border bg-surface">
        <div>
          <div className="px-4 py-5 text-lg font-semibold">PhishAware</div>
          <nav className="flex flex-col gap-1 px-2">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                    isActive
                      ? 'bg-accent text-white'
                      : 'text-text-secondary hover:bg-bg hover:text-text-primary'
                  }`
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border p-3">
          <button
            onClick={toggleTheme}
            aria-label="Farbmodus umschalten"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-text-primary hover:bg-bg"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            onClick={logout}
            className="flex flex-1 items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-text-primary hover:bg-bg"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  )
}
