import os
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from routes.bible_routes import user_bible_plan_routes


PLAN_ID = "656565656565656565656565"


class _AttrDict(dict):
    def __getattr__(self, item):
        try:
            return self[item]
        except KeyError as exc:  # pragma: no cover - mirrors dict behaviour
            raise AttributeError(item) from exc


def _stub_plan_collection(readings: dict, duration: int) -> SimpleNamespace:
    plan_doc = {
        "readings": readings,
        "duration": duration,
    }
    return SimpleNamespace(find_one=AsyncMock(return_value=plan_doc))


def _set_plan_doc(monkeypatch, readings: dict, duration: int) -> None:
    fake_collection = _stub_plan_collection(readings, duration)
    fake_db = _AttrDict({"bible_plans": fake_collection})
    monkeypatch.setattr(user_bible_plan_routes.DB, "db", fake_db)


pytestmark = pytest.mark.anyio("asyncio")


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture(autouse=True)
def restore_db():
    original_db = getattr(user_bible_plan_routes.DB, "db", None)
    yield
    user_bible_plan_routes.DB.db = original_db


@pytest.fixture
async def progress_app():
    app = FastAPI()

    @app.middleware("http")
    async def add_uid(request, call_next):  # type: ignore[override]
        request.state.uid = "test-user"
        return await call_next(request)

    app.include_router(user_bible_plan_routes.auth_bible_plan_router)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


async def test_allows_updating_first_day(monkeypatch, progress_app):
    fake_find = AsyncMock(return_value={"progress": []})
    fake_update = AsyncMock(return_value=True)
    monkeypatch.setattr(user_bible_plan_routes, "find_user_plan", fake_find)
    monkeypatch.setattr(user_bible_plan_routes, "update_user_bible_plan_progress", fake_update)
    _set_plan_doc(
        monkeypatch,
        readings={"1": [{"id": "verse-1"}]},
        duration=3,
    )

    response = await progress_app.put(
        f"/my-bible-plans/progress/{PLAN_ID}",
        json={
            "day": 1,
            "completed_passages": ["verse-1"],
            "is_completed": False,
        },
    )

    assert response.status_code == 200, response.text
    fake_update.assert_awaited_once()


async def test_blocks_future_day_before_previous_complete(monkeypatch, progress_app):
    fake_find = AsyncMock(
        return_value={
            "progress": [
                {"day": 1, "completed_passages": ["verse-1"], "is_completed": False},
            ]
        }
    )
    fake_update = AsyncMock(return_value=True)
    monkeypatch.setattr(user_bible_plan_routes, "find_user_plan", fake_find)
    monkeypatch.setattr(user_bible_plan_routes, "update_user_bible_plan_progress", fake_update)
    _set_plan_doc(
        monkeypatch,
        readings={
            "1": [{"id": "verse-1"}],
            "2": [{"id": "verse-2"}],
        },
        duration=3,
    )

    response = await progress_app.put(
        f"/my-bible-plans/progress/{PLAN_ID}",
        json={
            "day": 2,
            "completed_passages": ["verse-2"],
            "is_completed": True,
        },
    )

    assert response.status_code == 400
    fake_update.assert_not_awaited()


async def test_allows_next_day_after_completion(monkeypatch, progress_app):
    fake_find = AsyncMock(
        return_value={
            "progress": [
                {"day": 1, "completed_passages": ["verse-1"], "is_completed": True},
            ]
        }
    )
    fake_update = AsyncMock(return_value=True)
    monkeypatch.setattr(user_bible_plan_routes, "find_user_plan", fake_find)
    monkeypatch.setattr(user_bible_plan_routes, "update_user_bible_plan_progress", fake_update)
    _set_plan_doc(
        monkeypatch,
        readings={
            "1": [{"id": "verse-1"}],
            "2": [{"id": "verse-2"}],
        },
        duration=3,
    )

    response = await progress_app.put(
        f"/my-bible-plans/progress/{PLAN_ID}",
        json={
            "day": 2,
            "completed_passages": ["verse-2"],
            "is_completed": True,
        },
    )

    assert response.status_code == 200, response.text
    fake_update.assert_awaited_once()


async def test_rest_day_unlocks_next_day(monkeypatch, progress_app):
    fake_find = AsyncMock(
        return_value={
            "progress": [
                {"day": 1, "completed_passages": ["verse-1"], "is_completed": True},
            ]
        }
    )
    fake_update = AsyncMock(return_value=True)
    monkeypatch.setattr(user_bible_plan_routes, "find_user_plan", fake_find)
    monkeypatch.setattr(user_bible_plan_routes, "update_user_bible_plan_progress", fake_update)
    _set_plan_doc(
        monkeypatch,
        readings={
            "1": [{"id": "verse-1"}],
            "2": [],
            "3": [{"id": "verse-3"}],
        },
        duration=3,
    )

    response = await progress_app.put(
        f"/my-bible-plans/progress/{PLAN_ID}",
        json={
            "day": 3,
            "completed_passages": ["verse-3"],
            "is_completed": True,
        },
    )

    assert response.status_code == 200, response.text
    fake_update.assert_awaited_once()
