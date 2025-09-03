from fastapi import APIRouter, Body
from mongo.database import get_db

router = APIRouter()

def get_fcm_collection():
    db = get_db()
    return db['fcm_tokens']

@router.post('/save-fcm-token')
async def save_fcm_token(user_id: str = Body(...), token: str = Body(...)):
    collection = get_fcm_collection()
    # Upsert token for user
    result = await collection.update_one(
        {'user_id': user_id},
        {'$set': {'token': token}},
        upsert=True
    )
    return {"success": True, "matched": result.matched_count, "modified": result.modified_count}

@router.get('/get-fcm-tokens')
async def get_fcm_tokens():
    collection = get_fcm_collection()
    tokens = await collection.find({}, {'_id': 0, 'token': 1, 'user_id': 1}).to_list(length=1000)
    return tokens
