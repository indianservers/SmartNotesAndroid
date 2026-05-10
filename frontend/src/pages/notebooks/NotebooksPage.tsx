import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, BookOpen, Trash2, Edit3, MoreVertical } from 'lucide-react'
import { useNotesStore } from '@/stores/notesStore'
import { useNotes } from '@/hooks/useNotes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const COLORS = ['#6366f1', '#22c55e', '#f97316', '#ef4444', '#a855f7', '#14b8a6', '#eab308', '#ec4899']

export default function NotebooksPage() {
  const navigate = useNavigate()
  const { notebooks, notes, setActiveNotebook } = useNotesStore()
  const { createNotebook, deleteNotebook } = useNotes()
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newColor, setNewColor] = useState(COLORS[0])
  const [creating, setCreating] = useState(false)

  const noteCounts = notebooks.reduce((acc, nb) => {
    acc[nb.id] = notes.filter((n) => n.notebook_id === nb.id && !n.is_deleted).length
    return acc
  }, {} as Record<string, number>)

  async function handleCreate() {
    if (!newTitle.trim()) return
    setCreating(true)
    await createNotebook(newTitle.trim(), newColor)
    setNewTitle('')
    setShowCreate(false)
    setCreating(false)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/95 backdrop-blur-md px-4 py-3">
        <div className="mx-auto flex max-w-screen-sm items-center justify-between">
          <h1 className="text-lg font-bold">Notebooks</h1>
          <Button size="icon" variant="ghost" onClick={() => setShowCreate(true)}>
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-screen-sm px-4 py-4">
        {notebooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-2">
              <BookOpen className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <h3 className="mb-1 font-semibold">No notebooks yet</h3>
            <p className="mb-6 text-sm text-muted-foreground">Organize your notes into notebooks</p>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" /> Create Notebook
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {notebooks.filter((n) => !n.is_deleted).map((nb) => (
              <div
                key={nb.id}
                onClick={() => { setActiveNotebook(nb.id); navigate('/dashboard') }}
                className="group relative cursor-pointer rounded-2xl border border-border/60 bg-surface-2 p-4 transition-all hover:bg-surface-3 active:scale-[0.98]"
              >
                <div
                  className="mb-3 h-8 w-8 rounded-xl"
                  style={{ background: nb.color ?? '#6366f1' }}
                />
                <h3 className="font-semibold text-sm truncate">{nb.title}</h3>
                <p className="text-xs text-muted-foreground">{noteCounts[nb.id] ?? 0} notes</p>

                <div
                  className="absolute right-2 top-2 opacity-0 group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="rounded-lg p-1 hover:bg-surface-1">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem destructive onClick={() => deleteNotebook(nb.id)}>
                        <Trash2 className="h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Notebook</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              label="Notebook name"
              placeholder="My Notebook"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <div>
              <p className="mb-2 text-sm font-medium text-foreground/80">Color</p>
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className={cn(
                      'h-7 w-7 rounded-full transition-transform',
                      newColor === c ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-surface-1' : 'hover:scale-110',
                    )}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
            <Button className="w-full" onClick={handleCreate} loading={creating}>
              Create Notebook
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
