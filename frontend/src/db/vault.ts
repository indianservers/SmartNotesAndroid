import { v4 as uuidv4 } from 'uuid'
import type { LocalNote, LocalNotebook, LocalTag, Note, Notebook, Tag, NoteType, SyncStatus, EncryptedPayload } from '@/types'
import {
  encryptString,
  decryptString,
  encryptNote,
  decryptNote,
  type WrappedMasterKey,
} from '@/crypto/encryption'
import {
  saveNote,
  getNote,
  getNotesByUser,
  deleteNote as dbDeleteNote,
  saveNotebook,
  getNotebook,
  getNotebooksByUser,
  deleteNotebook as dbDeleteNotebook,
  saveTag,
  getTagsByUser,
  deleteTag as dbDeleteTag,
  addToSyncQueue,
  getPendingSyncQueue,
} from './indexeddb'

type EncPayload = EncryptedPayload

// ── Session master key (in-memory only) ──────────────────────────────────────

let _masterKey: CryptoKey | null = null
let _userId: string | null = null

export function setSessionKey(key: CryptoKey, userId: string): void {
  _masterKey = key
  _userId = userId
}

export function clearSessionKey(): void {
  _masterKey = null
  _userId = null
}

export function isVaultOpen(): boolean {
  return _masterKey !== null && _userId !== null
}

function requireVault(): { masterKey: CryptoKey; userId: string } {
  if (!_masterKey || !_userId) throw new Error('Vault is locked. Please log in.')
  return { masterKey: _masterKey, userId: _userId }
}

function now(): string {
  return new Date().toISOString()
}

async function queueSync(userId: string, entity_type: string, entity_id: string, operation: 'create' | 'update' | 'delete', payload?: unknown) {
  await addToSyncQueue({
    id: uuidv4(),
    user_id: userId,
    entity_type,
    entity_id,
    operation,
    payload: payload ? JSON.stringify(payload) : null,
    attempt_count: 0,
    last_error: null,
    status: 'pending',
    created_at: now(),
    updated_at: now(),
  })
}

// ── Notes ─────────────────────────────────────────────────────────────────────

export async function createNote(
  input: {
    title: string
    content: string
    note_type?: NoteType
    notebook_id?: string | null
    color?: string | null
    tags?: string[]
  },
): Promise<Note> {
  const { masterKey, userId } = requireVault()
  const id = uuidv4()
  const ts = now()
  const { encrypted_title, encrypted_payload, content_hash } = await encryptNote(
    input.title || 'Untitled',
    input.content || '',
    masterKey,
  )

  const local: LocalNote = {
    id,
    server_id: null,
    user_id: userId,
    notebook_id: input.notebook_id ?? null,
    note_type: input.note_type ?? 'rich',
    encrypted_title: JSON.stringify(encrypted_title),
    encrypted_payload: JSON.stringify(encrypted_payload),
    encrypted_note_key: null,
    encryption_version: 1,
    encryption_algorithm: 'AES-GCM',
    iv: encrypted_payload.iv,
    content_hash,
    color: input.color ?? null,
    icon: null,
    source_url: null,
    reminder_at: null,
    due_at: null,
    is_pinned: 0,
    is_favorite: 0,
    is_archived: 0,
    is_deleted: 0,
    sync_status: 'pending_create',
    sync_version: 1,
    local_updated_at: ts,
    server_updated_at: null,
    created_at: ts,
    deleted_at: null,
  }

  await saveNote(local)
  await queueSync(userId, 'note', id, 'create', local)

  return localNoteToNote(local, input.title, input.content)
}

export async function updateNote(
  id: string,
  updates: {
    title?: string
    content?: string
    color?: string | null
    is_pinned?: boolean
    is_favorite?: boolean
    is_archived?: boolean
    notebook_id?: string | null
    reminder_at?: string | null
    due_at?: string | null
  },
): Promise<Note> {
  const { masterKey, userId } = requireVault()
  const existing = await getNote(id)
  if (!existing) throw new Error(`Note ${id} not found`)

  let encTitle = existing.encrypted_title ? (JSON.parse(existing.encrypted_title) as EncPayload) : null
  let encPayload = JSON.parse(existing.encrypted_payload) as EncPayload
  let contentHash = existing.content_hash

  const ts = now()

  if (updates.title !== undefined || updates.content !== undefined) {
    const currentTitle = encTitle ? await decryptString(encTitle, masterKey) : 'Untitled'
    const currentContent = await decryptString(encPayload, masterKey)
    const newTitle = updates.title ?? currentTitle
    const newContent = updates.content ?? currentContent
    const result = await encryptNote(newTitle, newContent, masterKey)
    encTitle = result.encrypted_title
    encPayload = result.encrypted_payload
    contentHash = result.content_hash
  }

  const updated: LocalNote = {
    ...existing,
    encrypted_title: encTitle ? JSON.stringify(encTitle) : null,
    encrypted_payload: JSON.stringify(encPayload),
    iv: encPayload.iv,
    content_hash: contentHash,
    color: updates.color !== undefined ? updates.color : existing.color,
    is_pinned: updates.is_pinned !== undefined ? (updates.is_pinned ? 1 : 0) : existing.is_pinned,
    is_favorite: updates.is_favorite !== undefined ? (updates.is_favorite ? 1 : 0) : existing.is_favorite,
    is_archived: updates.is_archived !== undefined ? (updates.is_archived ? 1 : 0) : existing.is_archived,
    notebook_id: updates.notebook_id !== undefined ? updates.notebook_id : existing.notebook_id,
    reminder_at: updates.reminder_at !== undefined ? updates.reminder_at : existing.reminder_at,
    due_at: updates.due_at !== undefined ? updates.due_at : existing.due_at,
    sync_status: existing.sync_status === 'pending_create' ? 'pending_create' : 'pending_update',
    local_updated_at: ts,
  }

  await saveNote(updated)
  await queueSync(userId, 'note', id, 'update', updated)

  const decTitle = encTitle ? await decryptString(encTitle, masterKey) : 'Untitled'
  const decContent = await decryptString(encPayload, masterKey)
  return localNoteToNote(updated, decTitle, decContent)
}

export async function softDeleteNote(id: string): Promise<void> {
  const { userId } = requireVault()
  const existing = await getNote(id)
  if (!existing) return
  const ts = now()
  await saveNote({ ...existing, is_deleted: 1, deleted_at: ts, sync_status: 'pending_delete', local_updated_at: ts })
  await queueSync(userId, 'note', id, 'delete')
}

export async function restoreNote(id: string): Promise<void> {
  const { userId } = requireVault()
  const existing = await getNote(id)
  if (!existing) return
  const ts = now()
  await saveNote({ ...existing, is_deleted: 0, deleted_at: null, sync_status: 'pending_update', local_updated_at: ts })
  await queueSync(userId, 'note', id, 'update', existing)
}

export async function permanentDeleteNote(id: string): Promise<void> {
  await dbDeleteNote(id)
}

export async function getAllNotes(opts: { archived?: boolean; deleted?: boolean } = {}): Promise<Note[]> {
  const { masterKey, userId } = requireVault()
  const raw = await getNotesByUser(userId)

  const filtered = raw.filter((n) => {
    if (opts.deleted) return n.is_deleted === 1
    if (opts.archived) return n.is_archived === 1 && n.is_deleted === 0
    return n.is_deleted === 0 && n.is_archived === 0
  })

  const decrypted = await Promise.all(
    filtered.map(async (n) => {
      try {
        const encTitle = n.encrypted_title ? (JSON.parse(n.encrypted_title) as EncPayload) : null
        const encPayload = JSON.parse(n.encrypted_payload) as EncPayload
        const { title, content } = await decryptNote(encTitle, encPayload, masterKey)
        return localNoteToNote(n, title, content)
      } catch {
        return localNoteToNote(n, '[Encrypted]', '')
      }
    }),
  )
  return decrypted.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
}

export async function getNoteById(id: string): Promise<Note | null> {
  const { masterKey } = requireVault()
  const raw = await getNote(id)
  if (!raw) return null
  const encTitle = raw.encrypted_title ? (JSON.parse(raw.encrypted_title) as EncPayload) : null
  const encPayload = JSON.parse(raw.encrypted_payload) as EncPayload
  const { title, content } = await decryptNote(encTitle, encPayload, masterKey)
  return localNoteToNote(raw, title, content)
}

function localNoteToNote(raw: LocalNote, title: string, content: string): Note {
  return {
    id: raw.id,
    server_id: raw.server_id,
    notebook_id: raw.notebook_id,
    note_type: raw.note_type,
    title,
    content,
    color: raw.color,
    icon: raw.icon,
    source_url: raw.source_url,
    reminder_at: raw.reminder_at,
    due_at: raw.due_at,
    is_pinned: raw.is_pinned === 1,
    is_favorite: raw.is_favorite === 1,
    is_archived: raw.is_archived === 1,
    is_deleted: raw.is_deleted === 1,
    sync_status: raw.sync_status,
    created_at: raw.created_at,
    updated_at: raw.local_updated_at,
  }
}

// ── Notebooks ─────────────────────────────────────────────────────────────────

export async function createNotebook(title: string, color?: string, icon?: string, parentId?: string): Promise<Notebook> {
  const { masterKey, userId } = requireVault()
  const id = uuidv4()
  const ts = now()
  const encTitle = await encryptString(title, masterKey)
  const local: LocalNotebook = {
    id,
    server_id: null,
    user_id: userId,
    parent_id: parentId ?? null,
    encrypted_title: JSON.stringify(encTitle),
    encrypted_description: null,
    color: color ?? null,
    icon: icon ?? null,
    cover_file_id: null,
    sort_order: 0,
    is_pinned: 0,
    is_archived: 0,
    is_deleted: 0,
    sync_status: 'pending_create',
    sync_version: 1,
    created_at: ts,
    updated_at: ts,
    deleted_at: null,
  }
  await saveNotebook(local)
  await queueSync(userId, 'notebook', id, 'create', local)
  return localNotebookToNotebook(local, title)
}

export async function getAllNotebooks(): Promise<Notebook[]> {
  const { masterKey, userId } = requireVault()
  const raw = await getNotebooksByUser(userId)
  const active = raw.filter((n) => !n.is_deleted)
  return Promise.all(
    active.map(async (n) => {
      const encTitle = JSON.parse(n.encrypted_title) as EncPayload
      const title = await decryptString(encTitle, masterKey).catch(() => '[Encrypted]')
      return localNotebookToNotebook(n, title)
    }),
  )
}

export async function updateNotebook(id: string, updates: { title?: string; color?: string; icon?: string }): Promise<Notebook> {
  const { masterKey, userId } = requireVault()
  const existing = await getNotebook(id)
  if (!existing) throw new Error(`Notebook ${id} not found`)
  const ts = now()
  let encTitle = JSON.parse(existing.encrypted_title) as EncPayload
  let decTitle = await decryptString(encTitle, masterKey)
  if (updates.title) {
    encTitle = await encryptString(updates.title, masterKey)
    decTitle = updates.title
  }
  const updated: LocalNotebook = {
    ...existing,
    encrypted_title: JSON.stringify(encTitle),
    color: updates.color ?? existing.color,
    icon: updates.icon ?? existing.icon,
    sync_status: existing.sync_status === 'pending_create' ? 'pending_create' : 'pending_update',
    updated_at: ts,
  }
  await saveNotebook(updated)
  await queueSync(userId, 'notebook', id, 'update', updated)
  return localNotebookToNotebook(updated, decTitle)
}

export async function deleteNotebook(id: string): Promise<void> {
  const { userId } = requireVault()
  const existing = await getNotebook(id)
  if (!existing) return
  const ts = now()
  await saveNotebook({ ...existing, is_deleted: 1, deleted_at: ts, sync_status: 'pending_delete' })
  await queueSync(userId, 'notebook', id, 'delete')
}

function localNotebookToNotebook(raw: LocalNotebook, title: string): Notebook {
  return {
    id: raw.id,
    server_id: raw.server_id,
    parent_id: raw.parent_id ?? null,
    title,
    description: null,
    color: raw.color,
    icon: raw.icon,
    cover_file_id: raw.cover_file_id,
    sort_order: raw.sort_order,
    is_pinned: raw.is_pinned === 1,
    is_archived: raw.is_archived === 1,
    is_deleted: raw.is_deleted === 1,
    sync_status: raw.sync_status,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  }
}

// ── Tags ──────────────────────────────────────────────────────────────────────

export async function createTag(name: string, color?: string): Promise<Tag> {
  const { masterKey, userId } = requireVault()
  const id = uuidv4()
  const ts = now()
  const encName = await encryptString(name, masterKey)
  const local: LocalTag = {
    id,
    server_id: null,
    user_id: userId,
    encrypted_name: JSON.stringify(encName),
    color: color ?? null,
    usage_count: 0,
    is_deleted: 0,
    sync_status: 'pending_create',
    sync_version: 1,
    created_at: ts,
    updated_at: ts,
  }
  await saveTag(local)
  await queueSync(userId, 'tag', id, 'create', local)
  return localTagToTag(local, name)
}

export async function getAllTags(): Promise<Tag[]> {
  const { masterKey, userId } = requireVault()
  const raw = await getTagsByUser(userId)
  const active = raw.filter((t) => !t.is_deleted)
  return Promise.all(
    active.map(async (t) => {
      const encName = JSON.parse(t.encrypted_name) as EncPayload
      const name = await decryptString(encName, masterKey).catch(() => '[Encrypted]')
      return localTagToTag(t, name)
    }),
  )
}

function localTagToTag(raw: LocalTag, name: string): Tag {
  return {
    id: raw.id,
    server_id: raw.server_id,
    name,
    color: raw.color,
    usage_count: raw.usage_count,
    is_deleted: raw.is_deleted === 1,
    sync_status: raw.sync_status as SyncStatus,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  }
}

export async function getPendingSync() {
  if (!_userId) return []
  return getPendingSyncQueue(_userId)
}
