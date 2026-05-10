import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { OfflineBanner } from './OfflineBanner'
import { Toaster } from '@/components/ui/toast'

export function AppLayout() {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <OfflineBanner />
      <main className="flex-1 pb-20 pt-safe">
        <Outlet />
      </main>
      <BottomNav />
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-foreground)',
          },
        }}
      />
    </div>
  )
}
