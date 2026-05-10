import { NavLink } from 'react-router-dom'
import { Home, Search, BookOpen, Tag, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/dashboard', icon: Home, label: 'Home' },
  { to: '/search', icon: Search, label: 'Search' },
  { to: '/notebooks', icon: BookOpen, label: 'Notebooks' },
  { to: '/tags', icon: Tag, label: 'Tags' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-surface-1/95 backdrop-blur-md safe-area-pb">
      <div className="mx-auto flex max-w-screen-sm items-center justify-around px-2 py-1">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 rounded-xl px-3 py-2 text-xs transition-colors min-w-0',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn('h-5 w-5 transition-transform', isActive && 'scale-110')} />
                <span className="font-medium">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
