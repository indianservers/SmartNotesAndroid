import { create } from 'zustand'

type SyncState = 'idle' | 'syncing' | 'error' | 'offline'

interface SyncStore {
  state: SyncState
  lastSync: string | null
  pendingCount: number
  lastError: string | null
  syncToken: string | null

  setState: (s: SyncState) => void
  setLastSync: (ts: string) => void
  setPendingCount: (n: number) => void
  setLastError: (e: string | null) => void
  setSyncToken: (t: string | null) => void
}

export const useSyncStore = create<SyncStore>()((set) => ({
  state: 'idle',
  lastSync: null,
  pendingCount: 0,
  lastError: null,
  syncToken: null,

  setState: (s) => set({ state: s }),
  setLastSync: (ts) => set({ lastSync: ts }),
  setPendingCount: (n) => set({ pendingCount: n }),
  setLastError: (e) => set({ lastError: e }),
  setSyncToken: (t) => set({ syncToken: t }),
}))
