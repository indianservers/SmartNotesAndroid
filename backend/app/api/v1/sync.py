from datetime import datetime, timezone
from typing import Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.db.database import get_db
from app.models.models import User, Note, Notebook, Tag, NoteTag, SyncLog
from app.schemas.sync import SyncPushRequest, SyncPushResponse, SyncPullResponse, ConflictResolutionRequest
from app.api.v1.deps import get_current_user

router = APIRouter(prefix="/sync", tags=["sync"])


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _encode_token(user_id: str) -> str:
    return f"{user_id}:{datetime.now(timezone.utc).isoformat()}"


@router.post("/push", response_model=SyncPushResponse)
async def push_sync(
    body: SyncPushRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    entity_type = body.entity_type
    operation = body.operation
    payload = body.payload or {}
    client_id = body.entity_id

    if entity_type == "note":
        server_id = await _sync_note(db, current_user.id, client_id, operation, payload)
    elif entity_type == "notebook":
        server_id = await _sync_notebook(db, current_user.id, client_id, operation, payload)
    elif entity_type == "tag":
        server_id = await _sync_tag(db, current_user.id, client_id, operation, payload)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown entity type: {entity_type}")

    log = SyncLog(
        user_id=current_user.id,
        entity_type=entity_type,
        entity_id=server_id,
        operation=operation,
    )
    db.add(log)
    await db.commit()

    return SyncPushResponse(server_id=server_id, sync_version=1)


async def _sync_note(db: AsyncSession, user_id: str, client_id: str, operation: str, payload: dict) -> str:
    existing = await db.scalar(
        select(Note).where(Note.client_id == client_id, Note.user_id == user_id)
    )

    if operation == "delete":
        if existing:
            existing.is_deleted = True
            existing.deleted_at = utcnow()
            existing.sync_version += 1
        return existing.id if existing else client_id

    if operation == "create" or (operation == "update" and not existing):
        note = Note(
            id=str(uuid.uuid4()),
            client_id=client_id,
            user_id=user_id,
            notebook_id=payload.get("notebook_id"),
            note_type=payload.get("note_type", "rich"),
            encrypted_title=payload.get("encrypted_title"),
            encrypted_payload=payload.get("encrypted_payload", ""),
            encrypted_note_key=payload.get("encrypted_note_key"),
            encryption_version=payload.get("encryption_version", 1),
            encryption_algorithm=payload.get("encryption_algorithm", "AES-GCM"),
            iv=payload.get("iv"),
            content_hash=payload.get("content_hash"),
            color=payload.get("color"),
            is_pinned=payload.get("is_pinned", False),
            is_favorite=payload.get("is_favorite", False),
            is_archived=payload.get("is_archived", False),
            is_deleted=False,
            sync_version=1,
        )
        db.add(note)
        await db.flush()
        return note.id

    if operation == "update" and existing:
        existing.encrypted_title = payload.get("encrypted_title", existing.encrypted_title)
        existing.encrypted_payload = payload.get("encrypted_payload", existing.encrypted_payload)
        existing.iv = payload.get("iv", existing.iv)
        existing.content_hash = payload.get("content_hash", existing.content_hash)
        existing.color = payload.get("color", existing.color)
        existing.is_pinned = payload.get("is_pinned", existing.is_pinned)
        existing.is_favorite = payload.get("is_favorite", existing.is_favorite)
        existing.is_archived = payload.get("is_archived", existing.is_archived)
        existing.notebook_id = payload.get("notebook_id", existing.notebook_id)
        existing.sync_version += 1
        return existing.id

    return client_id


async def _sync_notebook(db: AsyncSession, user_id: str, client_id: str, operation: str, payload: dict) -> str:
    existing = await db.scalar(
        select(Notebook).where(Notebook.client_id == client_id, Notebook.user_id == user_id)
    )

    if operation == "delete":
        if existing:
            existing.is_deleted = True
        return existing.id if existing else client_id

    if operation == "create" or (operation == "update" and not existing):
        nb = Notebook(
            client_id=client_id,
            user_id=user_id,
            encrypted_title=payload.get("encrypted_title", ""),
            color=payload.get("color"),
            icon=payload.get("icon"),
            sync_version=1,
        )
        db.add(nb)
        await db.flush()
        return nb.id

    if operation == "update" and existing:
        existing.encrypted_title = payload.get("encrypted_title", existing.encrypted_title)
        existing.color = payload.get("color", existing.color)
        existing.sync_version += 1
        return existing.id

    return client_id


async def _sync_tag(db: AsyncSession, user_id: str, client_id: str, operation: str, payload: dict) -> str:
    existing = await db.scalar(
        select(Tag).where(Tag.client_id == client_id, Tag.user_id == user_id)
    )

    if operation == "delete":
        if existing:
            existing.is_deleted = True
        return existing.id if existing else client_id

    if operation == "create" or (operation == "update" and not existing):
        tag = Tag(
            client_id=client_id,
            user_id=user_id,
            encrypted_name=payload.get("encrypted_name", ""),
            color=payload.get("color"),
            sync_version=1,
        )
        db.add(tag)
        await db.flush()
        return tag.id

    if operation == "update" and existing:
        existing.encrypted_name = payload.get("encrypted_name", existing.encrypted_name)
        existing.color = payload.get("color", existing.color)
        existing.sync_version += 1
        return existing.id

    return client_id


@router.get("/pull", response_model=SyncPullResponse)
async def pull_sync(
    last_sync_token: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Parse last sync time from token
    since: Optional[datetime] = None
    if last_sync_token and ":" in last_sync_token:
        try:
            since = datetime.fromisoformat(last_sync_token.split(":", 1)[1])
        except ValueError:
            pass

    note_query = select(Note).where(Note.user_id == current_user.id)
    nb_query = select(Notebook).where(Notebook.user_id == current_user.id)
    tag_query = select(Tag).where(Tag.user_id == current_user.id)

    if since:
        note_query = note_query.where(Note.updated_at > since)
        nb_query = nb_query.where(Notebook.updated_at > since)
        tag_query = tag_query.where(Tag.updated_at > since)

    notes = (await db.scalars(note_query)).all()
    notebooks = (await db.scalars(nb_query)).all()
    tags = (await db.scalars(tag_query)).all()

    def note_to_dict(n: Note) -> dict:
        return {
            "id": n.id,
            "client_id": n.client_id,
            "user_id": n.user_id,
            "notebook_id": n.notebook_id,
            "note_type": n.note_type,
            "encrypted_title": n.encrypted_title,
            "encrypted_payload": n.encrypted_payload,
            "iv": n.iv,
            "content_hash": n.content_hash,
            "color": n.color,
            "is_pinned": n.is_pinned,
            "is_favorite": n.is_favorite,
            "is_archived": n.is_archived,
            "is_deleted": n.is_deleted,
            "sync_version": n.sync_version,
            "updated_at": n.updated_at.isoformat() if n.updated_at else None,
        }

    def nb_to_dict(nb: Notebook) -> dict:
        return {
            "id": nb.id,
            "client_id": nb.client_id,
            "encrypted_title": nb.encrypted_title,
            "color": nb.color,
            "is_deleted": nb.is_deleted,
            "sync_version": nb.sync_version,
            "updated_at": nb.updated_at.isoformat() if nb.updated_at else None,
        }

    def tag_to_dict(t: Tag) -> dict:
        return {
            "id": t.id,
            "client_id": t.client_id,
            "encrypted_name": t.encrypted_name,
            "color": t.color,
            "is_deleted": t.is_deleted,
            "sync_version": t.sync_version,
        }

    return SyncPullResponse(
        notes=[note_to_dict(n) for n in notes],
        notebooks=[nb_to_dict(nb) for nb in notebooks],
        tags=[tag_to_dict(t) for t in tags],
        sync_token=_encode_token(current_user.id),
    )


@router.post("/conflict")
async def resolve_conflict(
    body: ConflictResolutionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return {"detail": "Conflict resolved", "resolution": body.resolution}
