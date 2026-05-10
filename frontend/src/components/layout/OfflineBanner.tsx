import { useEffect, useState } from 'react'
import { WifiOff, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { useSyncStore } from '@/stores/syncStore'

export function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine)
  const { setOffline } = useAuthStore()
  const { pendingCount } = useSyncStore()

  useEffect(() => {
    function onOnline() { setOnline(true); setOffline(false) }
    function onOffline() { setOnline(false); setOffline(true) }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline) }
  }, [setOffline])

  if (online) return null

  return (
    <div className={cn(
      'fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2',
      'bg-amber-900/90 backdrop-blur-md px-4 py-2 text-xs font-medium text-amber-200',
    )}>
      <WifiOff className="h-3.5 w-3.5" />
      <span>Offline — {pendingCount > 0 ? `${pendingCount} changes pending sync` : 'all changes saved locally'}</span>
    </div>
  )
}

export function SyncBadge() {
  const { state, pendingCount } = useSyncStore()

  if (state === 'idle' && pendingCount === 0) return null

  return (
    <div className={cn(
      'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
      state === 'syncing' ? 'bg-blue-950/60 text-blue-400' :
      state === 'error' ? 'bg-red-950/60 text-red-400' :
      'bg-amber-950/60 text-amber-400',
    )}>
      <RefreshCw className={cn('h-3 w-3', state === 'syncing' && 'animate-spin')} />
      {state === 'syncing' ? 'Syncing…' : state === 'error' ? 'Sync error' : `${pendingCount} pending`}
    </div>
  )
}
