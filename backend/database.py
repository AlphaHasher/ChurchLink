import aiosqlite

DATABASE_URL = "users.db"

async def init_db():
    """
    Initializes the SQLite database and creates a users table if it doesn't exist.
    """
    async with aiosqlite.connect(DATABASE_URL) as db:
        await db.execute("""
        CREATE TABLE IF NOT EXISTS users (
            uid TEXT PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            display_name TEXT,
            role TEXT DEFAULT 'user'
        )
        """)
        await db.commit()

async def save_user(uid: str, email: str, display_name: str, role: str = "user"):
    """
    Saves a new user to the SQLite database.
    """
    async with aiosqlite.connect(DATABASE_URL) as db:
        await db.execute("""
        INSERT OR IGNORE INTO users (uid, email, display_name, role)
        VALUES (?, ?, ?, ?)
        """, (uid, email, display_name, role))
        await db.commit()

async def get_user(uid: str):
    """
    Retrieves a user from the database by UID.
    """
    async with aiosqlite.connect(DATABASE_URL) as db:
        async with db.execute("SELECT * FROM users WHERE uid = ?", (uid,)) as cursor:
            user = await cursor.fetchone()
            if user:
                return {"uid": user[0], "email": user[1], "display_name": user[2], "role": user[3]}
    return None