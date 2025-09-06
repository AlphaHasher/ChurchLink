from fastapi import APIRouter, HTTPException, status, Depends, Query
from models.bible_note import (
    BibleNoteCreate, 
    BibleNoteUpdate, 
    BibleNoteOut,
    create_bible_note,
    get_bible_notes_by_user,
    get_bible_notes_by_reference,
    get_bible_note_by_id,
    update_bible_note,
    delete_bible_note,
    search_bible_notes,
    BIBLE_BOOKS
)
from helpers.Firebase_helpers import authenticate_uid
from typing import Optional, List


bible_note_router = APIRouter(prefix="/bible-notes", tags=["Bible Notes"])


@bible_note_router.get("/", summary="Get user's Bible notes")
async def get_notes(
    skip: int = 0,
    limit: int = 100,
    book: Optional[str] = Query(None, description="Filter by Bible book"),
    chapter: Optional[int] = Query(None, description="Filter by chapter"),
    highlight_color: Optional[str] = Query(None, description="Filter by highlight color"),
    uid: str = Depends(authenticate_uid)
) -> List[BibleNoteOut]:
    """Get Bible notes for the authenticated user with optional filters"""
    return await get_bible_notes_by_user(
        user_id=uid,
        skip=skip,
        limit=limit,
        book=book,
        chapter=chapter,
        highlight_color=highlight_color
    )


@bible_note_router.post("/", summary="Create a new Bible note", status_code=status.HTTP_201_CREATED)
async def create_note(
    note: BibleNoteCreate,
    uid: str = Depends(authenticate_uid)
) -> BibleNoteOut:
    """Create a new Bible note for the authenticated user"""
    created_note = await create_bible_note(note, uid)
    if not created_note:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create Bible note"
        )
    return created_note


@bible_note_router.get("/search", summary="Search Bible notes")
async def search_notes(
    query: str = Query(..., description="Search query for note content"),
    skip: int = 0,
    limit: int = 100,
    book: Optional[str] = Query(None, description="Filter by Bible book"),
    highlight_color: Optional[str] = Query(None, description="Filter by highlight color"),
    uid: str = Depends(authenticate_uid)
) -> List[BibleNoteOut]:
    """Search Bible notes by content"""
    return await search_bible_notes(
        user_id=uid,
        query=query,
        skip=skip,
        limit=limit,
        book=book,
        highlight_color=highlight_color
    )


@bible_note_router.get("/books", summary="Get list of Bible books")
async def get_bible_books() -> List[str]:
    """Get the list of available Bible books"""
    return BIBLE_BOOKS


@bible_note_router.get("/reference/{book}", summary="Get notes for entire book")
async def get_notes_by_book(
    book: str,
    chapter_start: Optional[int] = Query(None, description="Start chapter for range"),
    chapter_end: Optional[int] = Query(None, description="End chapter for range"),
    uid: str = Depends(authenticate_uid)
) -> List[BibleNoteOut]:
    """Get Bible notes for an entire book or chapter range"""
    return await get_bible_notes_by_reference(
        user_id=uid,
        book=book,
        chapter_start=chapter_start,
        chapter_end=chapter_end
    )


@bible_note_router.get("/reference/{book}/{chapter}", summary="Get notes for specific chapter")
async def get_notes_by_chapter(
    book: str,
    chapter: int,
    verse_start: Optional[int] = Query(None, description="Start verse for range"),
    verse_end: Optional[int] = Query(None, description="End verse for range"),
    uid: str = Depends(authenticate_uid)
) -> List[BibleNoteOut]:
    """Get Bible notes for a specific chapter or verse range"""
    return await get_bible_notes_by_reference(
        user_id=uid,
        book=book,
        chapter=chapter,
        verse_start=verse_start,
        verse_end=verse_end
    )


@bible_note_router.get("/reference/{book}/{chapter}/{verse}", summary="Get notes for specific verse")
async def get_notes_by_verse(
    book: str,
    chapter: int,
    verse: int,
    uid: str = Depends(authenticate_uid)
) -> List[BibleNoteOut]:
    """Get Bible notes for a specific verse"""
    return await get_bible_notes_by_reference(
        user_id=uid,
        book=book,
        chapter=chapter,
        verse=verse
    )


@bible_note_router.get("/{note_id}", summary="Get specific Bible note")
async def get_note(
    note_id: str,
    uid: str = Depends(authenticate_uid)
) -> BibleNoteOut:
    """Get a specific Bible note by ID"""
    note = await get_bible_note_by_id(note_id, uid)
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bible note not found"
        )
    return note


@bible_note_router.put("/{note_id}", summary="Update Bible note")
async def update_note(
    note_id: str,
    update_data: BibleNoteUpdate,
    uid: str = Depends(authenticate_uid)
) -> BibleNoteOut:
    """Update a specific Bible note"""
    updated_note = await update_bible_note(note_id, uid, update_data)
    if not updated_note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bible note not found or update failed"
        )
    return updated_note


@bible_note_router.delete("/{note_id}", summary="Delete Bible note")
async def delete_note(
    note_id: str,
    uid: str = Depends(authenticate_uid)
) -> dict:
    """Delete a specific Bible note"""
    success = await delete_bible_note(note_id, uid)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bible note not found"
        )
    return {"message": "Bible note deleted successfully"}
