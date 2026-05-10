import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, MoreVertical, Pin, Star, Archive, Trash2,
  Palette, Save, Check, Clock, LayoutTemplate, Download,
  FileJson, FileText, FileType, FileCode,
} from 'lucide-react'
import { useNotes } from '@/hooks/useNotes'
import { useNotesStore } from '@/stores/notesStore'
import { RichTextEditor } from '@/components/editor/RichTextEditor'
import { ChecklistEditor } from '@/components/editor/ChecklistEditor'
import { PDFViewer } from '@/components/editor/PDFViewer'
import { VersionHistory } from '@/components/notes/VersionHistory'
import { TemplatesGallery } from '@/components/notes/TemplatesGallery'
import type { NoteTemplate } from '@/components/notes/TemplatesGallery'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn, NOTE_COLORS, NOTE_TYPE_LABELS } from '@/lib/utils'
import type { Note, NoteType } from '@/types'
import { toast } from 'sonner'
import { exportAsJSON, exportAsHTML, exportAsPDF, exportAsMarkdown } from '@/lib/exportNote'
import { createNoteVersion } from '@/db/tasksdb'
import { useAuthStore } from '@/stores/authStore'

const AUTO_SAVE_MS = 1500

export default function NoteEditorPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isNew = id === 'new'
  const noteType = (searchParams.get('type') ?? 'rich') as NoteType

  const { createNote, updateNote, deleteNote, pinNote, favoriteNote, archiveNote, getNoteById } = useNotes()
  const { notebooks, tags } = useNotesStore()

  const userId = useAuthStore((s) => s.user?.id ?? '')

  const [note, setNote] = useState<Note | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [color, setColor] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null)
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDirty = useRef(false)

  // Load existing note
  useEffect(() => {
    if (!isNew && id) {
      getNoteById(id).then((n) => {
        if (n) {
          setNote(n)
          setTitle(n.title)
          setContent(n.content)
          setColor(n.color)
          setCurrentNoteId(n.id)
        }
      })
    }
  }, [id, isNew, getNoteById])

  const save = useCallback(async () => {
    if (!isDirty.current) return
    isDirty.current = false
    setSaving(true)
    try {
      if (currentNoteId) {
        await updateNote(currentNoteId, { title, content, color })
        // Save version snapshot
        const wordCount = content.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
        await createNoteVersion({ note_id: currentNoteId, user_id: userId, title, content, word_count: wordCount })
      } else {
        const newNote = await createNote({ title, content, note_type: noteType, color })
        setCurrentNoteId(newNote.id)
        setNote(newNote)
        // Update URL without push
        window.history.replaceState({}, '', `/notes/${newNote.id}`)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      toast.error('Failed to save note')
    } finally {
      setSaving(false)
    }
  }, [currentNoteId, title, content, color, noteType, createNote, updateNote])

  function scheduleAutoSave() {
    isDirty.current = true
    setSaved(false)
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(save, AUTO_SAVE_MS)
  }

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setTitle(e.target.value)
    scheduleAutoSave()
  }

  function handleContentChange(html: string, _text: string) {
    setContent(html)
    scheduleAutoSave()
  }

  function handleChecklistChange(raw: string) {
    setContent(raw)
    scheduleAutoSave()
  }

  async function handleColorChange(c: string | null) {
    setColor(c)
    setShowColorPicker(false)
    if (currentNoteId) {
      await updateNote(currentNoteId, { color: c })
    }
  }

  async function handleDelete() {
    if (!currentNoteId) { navigate(-1); return }
    await deleteNote(currentNoteId)
    navigate('/dashboard')
  }

  async function handleArchive() {
    if (!currentNoteId) return
    await archiveNote(currentNoteId, true)
    navigate('/dashboard')
  }

  async function handlePin() {
    if (!currentNoteId || !note) return
    await pinNote(currentNoteId, !note.is_pinned)
    setNote((n) => n ? { ...n, is_pinned: !n.is_pinned } : n)
  }

  async function handleFavorite() {
    if (!currentNoteId || !note) return
    await favoriteNote(currentNoteId, !note.is_favorite)
    setNote((n) => n ? { ...n, is_favorite: !n.is_favorite } : n)
  }

  function handleTemplateSelect(template: NoteTemplate) {
    setTitle(template.title.replace('{Date}', new Date().toLocaleDateString()))
    setContent(template.content)
    isDirty.current = true
    scheduleAutoSave()
  }

  function handleRestoreVersion(version: import('@/types/tasks').NoteVersion) {
    setTitle(version.title)
    setContent(version.content)
    isDirty.current = true
    scheduleAutoSave()
    toast.success('Version restored')
  }

  // Save on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
      if (isDirty.current) save()
    }
  }, [save])

  const activeColor = NOTE_COLORS.find((c) => c.value === color)

  return (
    <div className={cn('min-h-screen', activeColor?.bg ?? 'bg-background')}>
      {/* Toolbar */}
      <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-border/40 bg-background/90 backdrop-blur-md px-4 py-2.5">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="flex-1 text-xs text-muted-foreground">
          {saving ? (
            <span className="flex items-center gap-1"><div className="h-2.5 w-2.5 animate-spin rounded-full border border-current border-t-transparent" /> Saving…</span>
          ) : saved ? (
            <span className="flex items-center gap-1 text-green-400"><Check className="h-3 w-3" /> Saved</span>
          ) : (
            <span>{NOTE_TYPE_LABELS[noteType] ?? 'Note'}</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Color picker */}
          <div className="relative">
            <Button variant="ghost" size="icon-sm" onClick={() => setShowColorPicker(!showColorPicker)} title="Change color">
              <Palette className="h-4 w-4" />
            </Button>
            {showColorPicker && (
              <div className="absolute right-0 top-full mt-1 z-50 rounded-xl border border-border/60 bg-surface-1 p-2 shadow-xl">
                <div className="grid grid-cols-5 gap-1.5">
                  {NOTE_COLORS.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => handleColorChange(c.value)}
                      className={cn(
                        'h-7 w-7 rounded-lg border-2 transition-all',
                        color === c.value ? 'border-primary scale-110' : 'border-transparent hover:scale-105',
                        c.value ? '' : 'bg-surface-3',
                      )}
                      style={c.value ? { background: c.value } : {}}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <Button variant="ghost" size="icon-sm" onClick={save} title="Save">
            <Save className="h-4 w-4" />
          </Button>

          {/* Templates (only for new notes) */}
          {isNew && (
            <Button variant="ghost" size="icon-sm" onClick={() => setShowTemplates(true)} title="Templates">
              <LayoutTemplate className="h-4 w-4" />
            </Button>
          )}

          {/* Version history (only for saved notes) */}
          {currentNoteId && (
            <Button variant="ghost" size="icon-sm" onClick={() => setShowVersionHistory(true)} title="Version history">
              <Clock className="h-4 w-4" />
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={handlePin}>
                <Pin className="h-4 w-4" /> {note?.is_pinned ? 'Unpin' : 'Pin'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleFavorite}>
                <Star className="h-4 w-4" /> {note?.is_favorite ? 'Unfavorite' : 'Favorite'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {/* Export */}
              {note && (
                <>
                  <DropdownMenuItem onClick={() => exportAsJSON([note])}>
                    <FileJson className="h-4 w-4" /> Export JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportAsHTML(note)}>
                    <FileCode className="h-4 w-4" /> Export HTML
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportAsMarkdown(note)}>
                    <FileText className="h-4 w-4" /> Export Markdown
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportAsPDF(note)}>
                    <Download className="h-4 w-4" /> Export PDF
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={handleArchive}>
                <Archive className="h-4 w-4" /> Archive
              </DropdownMenuItem>
              <DropdownMenuItem destructive onClick={handleDelete}>
                <Trash2 className="h-4 w-4" /> Move to Trash
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Editor */}
      <div className="mx-auto max-w-screen-sm px-4 py-5">
        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          placeholder="Note title…"
          className="mb-4 w-full bg-transparent text-2xl font-bold text-foreground placeholder:text-muted-foreground/30 outline-none"
        />

        {/* Content by type */}
        {(noteType === 'rich' || noteType === 'text' || noteType === 'meeting' || noteType === 'webclip') && (
          <RichTextEditor
            content={content}
            onChange={handleContentChange}
            placeholder={noteType === 'meeting' ? 'Meeting notes…' : 'Start writing…'}
          />
        )}

        {(noteType === 'checklist' || noteType === 'task') && (
          <ChecklistEditor
            content={content}
            onChange={handleChecklistChange}
          />
        )}

        {noteType === 'audio' && (
          <AudioNoteSection />
        )}

        {noteType === 'photo' && (
          <PhotoNoteSection />
        )}

        {(noteType === 'file' || noteType === 'pdf') && (
          <FileNoteSection />
        )}
      </div>

      {/* Version History dialog */}
      {currentNoteId && (
        <VersionHistory
          noteId={currentNoteId}
          open={showVersionHistory}
          onClose={() => setShowVersionHistory(false)}
          onRestore={handleRestoreVersion}
        />
      )}

      {/* Templates gallery */}
      <TemplatesGallery
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
        onSelect={handleTemplateSelect}
      />
    </div>
  )
}

function AudioNoteSection() {
  return (
    <div className="flex flex-col items-center gap-4 py-10">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-950/40 border-2 border-red-800/40">
        <span className="text-3xl">🎤</span>
      </div>
      <p className="text-sm text-muted-foreground">Audio recording requires Capacitor on mobile</p>
      <Button variant="outline" size="sm">Attach Audio File</Button>
    </div>
  )
}

function PhotoNoteSection() {
  return (
    <div className="flex flex-col items-center gap-4 py-10">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-950/40 border-2 border-blue-800/40">
        <span className="text-3xl">📷</span>
      </div>
      <p className="text-sm text-muted-foreground">Camera requires Capacitor on mobile</p>
      <Button variant="outline" size="sm">Attach Photo</Button>
    </div>
  )
}

function FileNoteSection() {
  return (
    <div className="flex flex-col items-center gap-4 py-10">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-surface-2 border border-border">
        <span className="text-3xl">📎</span>
      </div>
      <p className="text-sm text-muted-foreground">Attach any file to this note</p>
      <Button variant="outline" size="sm">Attach File</Button>
    </div>
  )
}
