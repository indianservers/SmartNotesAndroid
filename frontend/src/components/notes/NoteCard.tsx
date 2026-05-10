import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Pin, Star, Archive, Trash2, Copy, MoreVertical,
  BookOpen, Bell, Mic, Image, Paperclip, CheckSquare,
} from 'lucide-react'
import { cn, formatDate, truncate, stripHtml, getColorClasses } from '@/lib/utils'
import { useNotes } from '@/hooks/useNotes'
import type { Note } from '@/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'

const TYPE_ICON: Record<string, React.ElementType> = {
  audio: Mic,
  photo: Image,
  file: Paperclip,
  checklist: CheckSquare,
  task: CheckSquare,
}

interface Props {
  note: Note
  view?: 'grid' | 'list'
}

export function NoteCard({ note, view = 'grid' }: Props) {
  const navigate = useNavigate()
  const { deleteNote, pinNote, favoriteNote, archiveNote } = useNotes()
  const [menuOpen, setMenuOpen] = useState(false)

  const { bg, border } = getColorClasses(note.color)
  const preview = truncate(stripHtml(note.content), 120)
  const TypeIcon = TYPE_ICON[note.note_type]

  function handleOpen() {
    navigate(`/notes/${note.id}`)
  }

  if (view === 'list') {
    return (
      <div
        className={cn(
          'flex items-start gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-all',
          'active:scale-[0.99] hover:bg-surface-3/40',
          bg, border,
        )}
        onClick={handleOpen}
      >
        {note.color && (
          <div className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full" style={{ background: note.color }} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-sm text-foreground">{note.title || 'Untitled'}</span>
            {note.is_pinned && <Pin className="h-3 w-3 text-primary flex-shrink-0" />}
            {note.is_favorite && <Star className="h-3 w-3 text-amber-400 flex-shrink-0" />}
          </div>
          {preview && <p className="mt-0.5 text-xs text-muted-foreground truncate">{preview}</p>}
          <span className="text-[10px] text-muted-foreground/60">{formatDate(note.updated_at)}</span>
        </div>
        <NoteMenu note={note} onDelete={() => deleteNote(note.id)} onPin={() => pinNote(note.id, !note.is_pinned)} onFavorite={() => favoriteNote(note.id, !note.is_favorite)} onArchive={() => archiveNote(note.id, true)} open={menuOpen} setOpen={setMenuOpen} />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-2xl border p-4 cursor-pointer transition-all duration-200',
        'active:scale-[0.98] hover:shadow-lg hover:shadow-black/20',
        bg, border,
        note.is_pinned && 'ring-1 ring-primary/30',
      )}
      onClick={handleOpen}
    >
      {/* Header */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {TypeIcon && <TypeIcon className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />}
          <h3 className="truncate text-sm font-semibold text-foreground">
            {note.title || 'Untitled'}
          </h3>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1">
          {note.is_pinned && <Pin className="h-3.5 w-3.5 text-primary" />}
          {note.is_favorite && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
          <div onClick={(e) => e.stopPropagation()}>
            <NoteMenu
              note={note}
              onDelete={() => deleteNote(note.id)}
              onPin={() => pinNote(note.id, !note.is_pinned)}
              onFavorite={() => favoriteNote(note.id, !note.is_favorite)}
              onArchive={() => archiveNote(note.id, true)}
              open={menuOpen}
              setOpen={setMenuOpen}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      {preview && (
        <p className="mb-3 flex-1 text-xs leading-relaxed text-muted-foreground line-clamp-4">
          {preview}
        </p>
      )}

      {/* Checklist preview */}
      {note.note_type === 'checklist' && note.content && (
        <ChecklistPreview content={note.content} />
      )}

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between pt-2">
        <span className="text-[10px] text-muted-foreground/60">{formatDate(note.updated_at)}</span>
        <div className="flex items-center gap-2">
          {note.reminder_at && <Bell className="h-3 w-3 text-blue-400" />}
          {note.attachments && note.attachments.length > 0 && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
              {note.attachments.length}
            </Badge>
          )}
          {note.sync_status !== 'synced' && note.sync_status !== 'pending_create' && (
            <div className="h-1.5 w-1.5 rounded-full bg-amber-400" title="Pending sync" />
          )}
        </div>
      </div>
    </div>
  )
}

function ChecklistPreview({ content }: { content: string }) {
  let items: Array<{ text: string; checked: boolean }> = []
  try {
    const parsed = JSON.parse(content)
    if (parsed.type === 'checklist') items = parsed.items?.slice(0, 4) ?? []
  } catch { return null }

  if (!items.length) return null
  const done = items.filter((i) => i.checked).length

  return (
    <div className="mb-3 space-y-1">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <div className={cn('h-3.5 w-3.5 rounded flex-shrink-0 border', item.checked ? 'bg-primary border-primary' : 'border-border')} />
          <span className={cn('truncate', item.checked && 'line-through text-muted-foreground')}>{item.text}</span>
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground/60">{done}/{items.length} done</p>
    </div>
  )
}

function NoteMenu({
  note, onDelete, onPin, onFavorite, onArchive, open, setOpen,
}: {
  note: Note
  onDelete: () => void
  onPin: () => void
  onFavorite: () => void
  onArchive: () => void
  open: boolean
  setOpen: (v: boolean) => void
}) {
  const navigate = useNavigate()
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button className="rounded-lg p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-surface-3 data-[state=open]:opacity-100">
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => navigate(`/notes/${note.id}`)}>
          <BookOpen className="h-4 w-4" /> Open
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onPin}>
          <Pin className="h-4 w-4" /> {note.is_pinned ? 'Unpin' : 'Pin'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onFavorite}>
          <Star className="h-4 w-4" /> {note.is_favorite ? 'Unfavorite' : 'Favorite'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onArchive}>
          <Archive className="h-4 w-4" /> Archive
        </DropdownMenuItem>
        <DropdownMenuItem destructive onClick={onDelete}>
          <Trash2 className="h-4 w-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
