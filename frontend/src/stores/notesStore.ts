import { create } from 'zustand'
import type { Note, Notebook, Tag, SearchFilters } from '@/types'

interface NotesState {
  notes: Note[]
  notebooks: Notebook[]
  tags: Tag[]
  activeNote: Note | null
  activeNotebook: string | null
  searchFilters: SearchFilters
  isLoading: boolean
  isSyncing: boolean
  view: 'grid' | 'list'

  setNotes: (notes: Note[]) => void
  setNotebooks: (notebooks: Notebook[]) => void
  setTags: (tags: Tag[]) => void
  setActiveNote: (note: Note | null) => void
  setActiveNotebook: (id: string | null) => void
  setSearchFilters: (filters: Partial<SearchFilters>) => void
  clearSearchFilters: () => void
  setLoading: (v: boolean) => void
  setSyncing: (v: boolean) => void
  setView: (v: 'grid' | 'list') => void
  addNote: (note: Note) => void
  updateNoteInStore: (note: Note) => void
  removeNote: (id: string) => void
  addNotebook: (nb: Notebook) => void
  updateNotebookInStore: (nb: Notebook) => void
  removeNotebook: (id: string) => void
  addTag: (tag: Tag) => void
  removeTag: (id: string) => void
}

export const useNotesStore = create<NotesState>()((set, get) => ({
  notes: [],
  notebooks: [],
  tags: [],
  activeNote: null,
  activeNotebook: null,
  searchFilters: { query: '' },
  isLoading: false,
  isSyncing: false,
  view: 'grid',

  setNotes: (notes) => set({ notes }),
  setNotebooks: (notebooks) => set({ notebooks }),
  setTags: (tags) => set({ tags }),
  setActiveNote: (note) => set({ activeNote: note }),
  setActiveNotebook: (id) => set({ activeNotebook: id }),
  setSearchFilters: (filters) => set((s) => ({ searchFilters: { ...s.searchFilters, ...filters } })),
  clearSearchFilters: () => set({ searchFilters: { query: '' } }),
  setLoading: (v) => set({ isLoading: v }),
  setSyncing: (v) => set({ isSyncing: v }),
  setView: (v) => set({ view: v }),

  addNote: (note) => set((s) => ({ notes: [note, ...s.notes] })),
  updateNoteInStore: (note) =>
    set((s) => ({
      notes: s.notes.map((n) => (n.id === note.id ? note : n)),
      activeNote: s.activeNote?.id === note.id ? note : s.activeNote,
    })),
  removeNote: (id) =>
    set((s) => ({
      notes: s.notes.filter((n) => n.id !== id),
      activeNote: s.activeNote?.id === id ? null : s.activeNote,
    })),

  addNotebook: (nb) => set((s) => ({ notebooks: [...s.notebooks, nb] })),
  updateNotebookInStore: (nb) =>
    set((s) => ({ notebooks: s.notebooks.map((n) => (n.id === nb.id ? nb : n)) })),
  removeNotebook: (id) => set((s) => ({ notebooks: s.notebooks.filter((n) => n.id !== id) })),

  addTag: (tag) => set((s) => ({ tags: [...s.tags, tag] })),
  removeTag: (id) => set((s) => ({ tags: s.tags.filter((t) => t.id !== id) })),
}))

// Derived selectors
export function useFilteredNotes() {
  return useNotesStore((s) => {
    let notes = s.notes
    const f = s.searchFilters

    if (s.activeNotebook) {
      notes = notes.filter((n) => n.notebook_id === s.activeNotebook)
    }
    if (f.query) {
      const q = f.query.toLowerCase()
      notes = notes.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q),
      )
    }
    if (f.note_type) notes = notes.filter((n) => n.note_type === f.note_type)
    if (f.is_pinned) notes = notes.filter((n) => n.is_pinned)
    if (f.is_favorite) notes = notes.filter((n) => n.is_favorite)
    if (f.has_attachment) notes = notes.filter((n) => n.attachments && n.attachments.length > 0)

    const pinned = notes.filter((n) => n.is_pinned)
    const rest = notes.filter((n) => !n.is_pinned)
    return [...pinned, ...rest]
  })
}
