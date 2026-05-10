import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, RefreshCw, Grid3X3, List, Filter,
  FileText, CheckSquare, Mic, Image, Paperclip,
  Pin, Star, Archive, Trash2, Clock,
} from 'lucide-react'
import { useNotesStore, useFilteredNotes } from '@/stores/notesStore'
import { useAuthStore } from '@/stores/authStore'
import { useSyncStore } from '@/stores/syncStore'
import { useNotes } from '@/hooks/useNotes'
import { NoteCard } from '@/components/notes/NoteCard'
import { SyncBadge } from '@/components/layout/OfflineBanner'
import { Button } from '@/components/ui/button'
import { cn, getInitials } from '@/lib/utils'
import type { NoteType } from '@/types'

const NOTE_TYPES: Array<{ type: NoteType | null; label: string; icon: React.ElementType }> = [
  { type: null, label: 'All', icon: FileText },
  { type: 'checklist', label: 'Checklist', icon: CheckSquare },
  { type: 'audio', label: 'Audio', icon: Mic },
  { type: 'photo', label: 'Photo', icon: Image },
  { type: 'file', label: 'File', icon: Paperclip },
]

const SMART_VIEWS = [
  { key: 'all', label: 'All Notes', icon: FileText },
  { key: 'pinned', label: 'Pinned', icon: Pin },
  { key: 'favorites', label: 'Favorites', icon: Star },
  { key: 'archived', label: 'Archived', icon: Archive },
  { key: 'trash', label: 'Trash', icon: Trash2 },
  { key: 'recent', label: 'Recent', icon: Clock },
]

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { view, setView, setSearchFilters, isLoading, notebooks, activeNotebook, setActiveNotebook } = useNotesStore()
  const { syncNow, refreshAll } = useNotes()
  const { state: syncState, pendingCount } = useSyncStore()
  const [activeTypeFilter, setActiveTypeFilter] = useState<NoteType | null>(null)
  const [smartView, setSmartView] = useState('all')
  const [showTypeFilter, setShowTypeFilter] = useState(false)
  const filteredNotes = useFilteredNotes()

  useEffect(() => {
    refreshAll()
  }, [refreshAll])

  // Handle smart view changes
  useEffect(() => {
    setSearchFilters({
      is_pinned: smartView === 'pinned' ? true : undefined,
      is_favorite: smartView === 'favorites' ? true : undefined,
    })
  }, [smartView, setSearchFilters])

  function handleTypeFilter(type: NoteType | null) {
    setActiveTypeFilter(type)
    setSearchFilters({ note_type: type ?? undefined })
  }

  function handleNewNote(type: NoteType = 'rich') {
    navigate(`/notes/new?type=${type}`)
  }

  const pinnedNotes = filteredNotes.filter((n) => n.is_pinned && !n.is_archived && !n.is_deleted)
  const otherNotes = filteredNotes.filter((n) => !n.is_pinned && !n.is_archived && !n.is_deleted)
  const archivedNotes = filteredNotes.filter((n) => n.is_archived && !n.is_deleted)
  const trashedNotes = filteredNotes.filter((n) => n.is_deleted)

  let displayNotes = otherNotes
  if (smartView === 'pinned') displayNotes = pinnedNotes
  else if (smartView === 'archived') displayNotes = archivedNotes
  else if (smartView === 'trash') displayNotes = trashedNotes
  else if (smartView === 'all') displayNotes = filteredNotes.filter((n) => !n.is_deleted && !n.is_archived)

  return (
    <div className="relative min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/95 backdrop-blur-md">
        <div className="mx-auto max-w-screen-sm px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/20 text-xs font-bold text-primary">
                {user ? getInitials(user.full_name ?? user.email) : 'SN'}
              </div>
              <div>
                <h1 className="text-base font-semibold leading-none">Smart Notes</h1>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SyncBadge />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => syncNow()}
                className={cn(syncState === 'syncing' && 'animate-spin')}
                title="Sync"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setView(view === 'grid' ? 'list' : 'grid')}>
                {view === 'grid' ? <List className="h-4 w-4" /> : <Grid3X3 className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Notebook tabs */}
        {notebooks.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto px-4 pb-2 scrollbar-none">
            <button
              onClick={() => setActiveNotebook(null)}
              className={cn(
                'flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                !activeNotebook ? 'bg-primary text-white' : 'bg-surface-2 text-muted-foreground hover:text-foreground',
              )}
            >
              All
            </button>
            {notebooks.map((nb) => (
              <button
                key={nb.id}
                onClick={() => setActiveNotebook(nb.id)}
                className={cn(
                  'flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  activeNotebook === nb.id ? 'bg-primary text-white' : 'bg-surface-2 text-muted-foreground hover:text-foreground',
                )}
              >
                {nb.title}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="mx-auto max-w-screen-sm px-4 py-4">
        {/* Smart views */}
        <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {SMART_VIEWS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setSmartView(key)}
              className={cn(
                'flex flex-shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors',
                smartView === key
                  ? 'bg-primary/15 text-primary'
                  : 'bg-surface-2 text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <div className="mb-4 flex items-center gap-2">
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none flex-1">
            {NOTE_TYPES.map(({ type, label, icon: Icon }) => (
              <button
                key={label}
                onClick={() => handleTypeFilter(type)}
                className={cn(
                  'flex flex-shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors',
                  activeTypeFilter === type
                    ? 'bg-primary text-white'
                    : 'bg-surface-2 text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && displayNotes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-2">
              <FileText className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <h3 className="mb-1 font-semibold text-foreground/80">No notes yet</h3>
            <p className="mb-6 text-sm text-muted-foreground">Tap the + button to create your first encrypted note</p>
            <Button onClick={() => handleNewNote()} size="sm">
              <Plus className="h-4 w-4" />
              Create Note
            </Button>
          </div>
        )}

        {/* Pinned notes section */}
        {smartView === 'all' && pinnedNotes.length > 0 && (
          <section className="mb-4">
            <div className="mb-2 flex items-center gap-2">
              <Pin className="h-3.5 w-3.5 text-primary" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pinned</h2>
            </div>
            <div className={cn(view === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-2')}>
              {pinnedNotes.map((note) => (
                <NoteCard key={note.id} note={note} view={view} />
              ))}
            </div>
          </section>
        )}

        {/* Main notes */}
        {displayNotes.length > 0 && (
          <section>
            {smartView === 'all' && otherNotes.length > 0 && (
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {activeNotebook ? notebooks.find((n) => n.id === activeNotebook)?.title : 'Recent'}
              </h2>
            )}
            <div className={cn(view === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-2')}>
              {(smartView === 'all' ? otherNotes : displayNotes).map((note) => (
                <NoteCard key={note.id} note={note} view={view} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* FAB - New Note */}
      <button
        onClick={() => handleNewNote()}
        className={cn(
          'fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-2xl',
          'bg-primary text-white shadow-lg shadow-primary/30 transition-transform active:scale-95',
          'hover:bg-primary/90',
        )}
        title="New Note"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  )
}
