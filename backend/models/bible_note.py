from typing import Optional, List, Literal
from datetime import datetime
from pydantic import BaseModel, Field, model_validator
from bson import ObjectId
from mongo.database import DB
from models.base.ssbc_base_model import MongoBaseModel


 


# Bible books list for validation
BIBLE_BOOKS = [
    # Old Testament
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
    "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
    "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles",
    "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs",
    "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations",
    "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah",
    "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah",
    "Haggai", "Zechariah", "Malachi",
    # New Testament
    "Matthew", "Mark", "Luke", "John", "Acts", "Romans",
    "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
    "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians",
    "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews",
    "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John",
    "Jude", "Revelation"
]


class BibleNoteBase(BaseModel):
    book: str = Field(..., description="Bible book name")
    chapter: int = Field(..., ge=1, description="Chapter number")
    verse_start: int = Field(..., ge=1, description="Starting verse number")
    verse_end: Optional[int] = Field(None, ge=1, description="Ending verse number (optional, for verse ranges)")
    note: str = Field(..., description="User's note content")
    highlight_color: Literal["blue", "red", "yellow", "green", "purple"] = Field(
        default="yellow", description="Highlight color"
    )

    @model_validator(mode='after')
    def validate_bible_note(self):
        """Automatically validate book name and verse range when model is created"""
        validate_book_name(self.book)
        validate_verse_range_values(self.verse_start, self.verse_end)
        return self

def validate_book_name(book: str) -> None:
    """Validate that the book name is a valid Bible book"""
    if book not in BIBLE_BOOKS:
        raise ValueError(f"Invalid Bible book: {book}")


def validate_verse_range_values(verse_start: int, verse_end: Optional[int]) -> None:
    """Validate that verse range is logical (end >= start)"""
    if verse_end and verse_end < verse_start:
        raise ValueError("verse_end must be greater than or equal to verse_start")


class BibleNoteCreate(BibleNoteBase):
    pass


class BibleNoteUpdate(BaseModel):
    note: Optional[str] = None
    highlight_color: Optional[Literal["blue", "red", "yellow", "green", "purple"]] = None


class BibleNote(MongoBaseModel, BibleNoteBase):
    user_id: str = Field(..., description="User ID who created the note")


class BibleNoteOut(BaseModel):
    id: str
    book: str
    chapter: int
    verse_start: int
    verse_end: Optional[int]
    note: str
    highlight_color: str
    user_id: str
    created_at: datetime
    updated_at: datetime


# CRUD Operations

async def create_bible_note(note_data: BibleNoteCreate, user_id: str) -> Optional[BibleNoteOut]:
    """Create a new Bible note"""
    try:
        note_doc = {
            "book": note_data.book,
            "chapter": note_data.chapter,
            "verse_start": note_data.verse_start,
            "verse_end": note_data.verse_end,
            "note": note_data.note,
            "highlight_color": note_data.highlight_color,
            "user_id": user_id,
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }
        
        result = await DB.db.bible_notes.insert_one(note_doc)
        
        if result.inserted_id:
            # Fetch the created note
            created_note = await DB.db.bible_notes.find_one({"_id": result.inserted_id})
            if created_note:
                return _convert_db_note_to_output(created_note)
        return None
    except Exception as e:
        print(f"Error creating Bible note: {e}")
        return None


async def get_bible_notes_by_user(
    user_id: str,
    skip: int = 0,
    limit: int = 100,
    book: Optional[str] = None,
    chapter: Optional[int] = None,
    highlight_color: Optional[str] = None
) -> List[BibleNoteOut]:
    """Get Bible notes for a specific user with optional filters"""
    try:
        query = {"user_id": user_id}
        
        if book:
            query["book"] = book
        if chapter:
            query["chapter"] = chapter
        if highlight_color:
            query["highlight_color"] = highlight_color
        
        # Execute query with pagination
        cursor = DB.db.bible_notes.find(query).skip(skip).limit(limit).sort([("book", 1), ("chapter", 1), ("verse_start", 1)])
        notes = await cursor.to_list(length=limit)
        
        return [_convert_db_note_to_output(note) for note in notes]
    except Exception as e:
        print(f"Error fetching Bible notes: {e}")
        return []


async def get_bible_notes_by_reference(
    user_id: str,
    book: str,
    chapter: Optional[int] = None,
    verse: Optional[int] = None,
    verse_start: Optional[int] = None,
    verse_end: Optional[int] = None,
    chapter_start: Optional[int] = None,
    chapter_end: Optional[int] = None
) -> List[BibleNoteOut]:
    """Get Bible notes by reference with range support"""
    try:
        validate_book_name(book)
        
        query = {"user_id": user_id, "book": book}
        
        if chapter_start and chapter_end:
            query["chapter"] = {"$gte": chapter_start, "$lte": chapter_end}
        elif chapter:
            query["chapter"] = chapter
        
        if chapter:
            verse_query = _build_verse_overlap_query(verse, verse_start, verse_end)
            if verse_query:
                query.update(verse_query)
        
        cursor = DB.db.bible_notes.find(query).sort([("chapter", 1), ("verse_start", 1)])
        notes = await cursor.to_list(length=None)
        
        return [_convert_db_note_to_output(note) for note in notes]
    except Exception as e:
        print(f"Error fetching Bible notes by reference: {e}")
        return []


async def get_bible_note_by_id(note_id: str, user_id: str) -> Optional[BibleNoteOut]:
    """Get a specific Bible note by ID for a user"""
    try:
        note = await DB.db.bible_notes.find_one({
            "_id": ObjectId(note_id),
            "user_id": user_id
        })
        
        return _convert_db_note_to_output(note) if note else None
    except Exception as e:
        print(f"Error fetching Bible note by ID: {e}")
        return None


async def update_bible_note(note_id: str, user_id: str, update_data: BibleNoteUpdate) -> Optional[BibleNoteOut]:
    """Update a Bible note"""
    try:
        update_doc = {"updated_at": datetime.now()}
        
        if update_data.note is not None:
            update_doc["note"] = update_data.note
        if update_data.highlight_color is not None:
            update_doc["highlight_color"] = update_data.highlight_color
        
        result = await DB.db.bible_notes.update_one(
            {"_id": ObjectId(note_id), "user_id": user_id},
            {"$set": update_doc}
        )
        
        if result.modified_count > 0:
            return await get_bible_note_by_id(note_id, user_id)
        return None
    except Exception as e:
        print(f"Error updating Bible note: {e}")
        return None


async def delete_bible_note(note_id: str, user_id: str) -> bool:
    """Delete a Bible note"""
    try:
        result = await DB.db.bible_notes.delete_one({
            "_id": ObjectId(note_id),
            "user_id": user_id
        })
        return result.deleted_count > 0
    except Exception as e:
        print(f"Error deleting Bible note: {e}")
        return False


async def search_bible_notes(
    user_id: str,
    query: str,
    skip: int = 0,
    limit: int = 100,
    book: Optional[str] = None,
    highlight_color: Optional[str] = None
) -> List[BibleNoteOut]:
    """Search Bible notes by content"""
    try:
        search_filter = {
            "user_id": user_id,
            "note": {"$regex": query, "$options": "i"}  # Case-insensitive search
        }
        
        if book:
            search_filter["book"] = book
        if highlight_color:
            search_filter["highlight_color"] = highlight_color
        
        cursor = DB.db.bible_notes.find(search_filter).skip(skip).limit(limit).sort([("book", 1), ("chapter", 1), ("verse_start", 1)])
        notes = await cursor.to_list(length=limit)
        
        return [_convert_db_note_to_output(note) for note in notes]
    except Exception as e:
        print(f"Error searching Bible notes: {e}")
        return []

def _convert_db_note_to_output(note_doc: dict) -> BibleNoteOut:
    """Convert database document to BibleNoteOut model"""
    return BibleNoteOut(
        id=str(note_doc["_id"]),
        book=note_doc["book"],
        chapter=note_doc["chapter"],
        verse_start=note_doc["verse_start"],
        verse_end=note_doc.get("verse_end"),
        note=note_doc["note"],
        highlight_color=note_doc["highlight_color"],
        user_id=note_doc["user_id"],
        created_at=note_doc["created_at"],
        updated_at=note_doc["updated_at"]
    )


def _build_verse_overlap_query(verse: Optional[int], verse_start: Optional[int], verse_end: Optional[int]) -> dict:
    """Build MongoDB query for verse overlap detection"""
    if verse_start and verse_end:
        return {
            "$or": [
                {"verse_start": {"$lte": verse_end}, "verse_end": {"$gte": verse_start}},
                {"verse_end": None, "verse_start": {"$gte": verse_start, "$lte": verse_end}}
            ]
        }
    elif verse:
        return {
            "$or": [
                {"verse_start": verse, "verse_end": None},
                {"verse_start": {"$lte": verse}, "verse_end": {"$gte": verse}}
            ]
        }
    return {}
