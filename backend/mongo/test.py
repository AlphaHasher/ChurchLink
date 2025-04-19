import asyncio
from database import DB
# Import new models and functions

async def main():
    # Start
    await DB.init_db()

    # End
    DB.close_db()

if __name__ == "__main__":
    asyncio.run(main())