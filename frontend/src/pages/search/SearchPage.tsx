import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, Filter, SlidersHorizontal } from 'lucide-react'
import { useNotesStore } from '@/stores/notesStore'
import { NoteCard } from '@/components/notes/NoteCard'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn, NOTE_TYPE_LABELS, stripHtml } from '@/lib/utils'
import type { NoteType } from '@/types'

const FILTERS: Array<{ type: NoteType; label: string }> = [
  { type: 'rich', label: 'Rich' },
  { type: 'checklist', label: 'Checklist' },
  { type: 'audio', label: 'Audio' },
  { type: 'photo', label: 'Photo' },
  { type: 'file', label: 'File' },
]

export default function SearchPage() {
  const navigate = useNavigate()
  const { notes, tags } = useNotesStore()
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<NoteType | null>(null)
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const results = useMemo(() => {
    if (!query && !typeFilter && !tagFilter) return []
    return notes
      .filter((n) => !n.is_deleted)
      .filter((n) => {
        if (typeFilter && n.note_type !== typeFilter) return false
        if (tagFilter && !n.tags?.some((t) => t.id === tagFilter)) return false
        if (!query) return true
        const q = query.toLowerCase()
        return (
          n.title.toLowerCase().includes(q) ||
          stripHtml(n.content).toLowerCase().includes(q)
        )
      })
  }, [query, typeFilter, tagFilter, notes])

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/95 backdrop-blur-md px-4 py-3">
        <div className="mx-auto max-w-screen-sm">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search notes…"
                autoFocus
                className={cn(
                  'w-full rounded-xl border border-border/60 bg-surface-2 py-2.5 pl-9 pr-9 text-sm',
                  'placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50',
                )}
              />
              {query && (
                <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={() => setShowFilters(!showFilters)}>
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </div>

          {showFilters && (
            <div className="mt-3 space-y-3">
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Note Type</p>
                <div className="flex flex-wrap gap-1.5">
                  {FILTERS.map(({ type, label }) => (
                    <button
                      key={type}
                      onClick={() => setTypeFilter(typeFilter === type ? null : type)}
                      className={cn(
                        'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                        typeFilter === type ? 'bg-primary text-white' : 'bg-surface-2 text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {tags.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Tag</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => setTagFilter(tagFilter === tag.id ? null : tag.id)}
                        className={cn(
                          'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                          tagFilter === tag.id ? 'bg-primary text-white' : 'bg-surface-2 text-muted-foreground',
                        )}
                      >
                        <div className="h-2 w-2 rounded-full" style={{ background: tag.color ?? '#6366f1' }} />
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-screen-sm px-4 py-4">
        {!query && !typeFilter && !tagFilter ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Search className="mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Search your encrypted notes</p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <X className="mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="font-medium text-foreground/80">No results</p>
            <p className="text-sm text-muted-foreground">Try a different search term</p>
          </div>
        ) : (
          <div>
            <p className="mb-3 text-xs text-muted-foreground">{results.length} result{results.length !== 1 ? 's' : ''}</p>
            <div className="space-y-2">
              {results.map((note) => (
                <NoteCard key={note.id} note={note} view="list" />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
