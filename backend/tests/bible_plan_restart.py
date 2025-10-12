import os
import sys
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

TESTS_DIR = os.path.dirname(__file__)
PROJECT_ROOT = os.path.abspath(os.path.join(TESTS_DIR, "..", ".."))

if PROJECT_ROOT not in sys.path:
    sys.path.append(PROJECT_ROOT)

from models.bible_plan_tracker import reset_user_bible_plan
from mongo.database import DB
from routes.bible_routes import user_bible_plan_routes


pytestmark = pytest.mark.anyio("asyncio")


class _FakeUpdateResult(SimpleNamespace):
    matched_count: int = 0


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture(autouse=True)
def restore_db():
    original_db = DB.db
    yield
    DB.db = original_db


async def test_reset_user_bible_plan_updates_progress():
    update_mock = AsyncMock(return_value=_FakeUpdateResult(matched_count=1))
    fake_collection = SimpleNamespace(update_one=update_mock)
    DB.db = {"bible_plan_tracker": fake_collection}

    new_start = datetime(2025, 1, 1)

    result = await reset_user_bible_plan("uid-123", "plan-456", new_start)

    assert result is True
    update_mock.assert_awaited_once_with(
        {"uid": "uid-123", "plan_id": "plan-456"},
        {"$set": {"progress": [], "start_date": new_start}},
    )


async def test_reset_user_bible_plan_returns_false_when_not_found():
    update_mock = AsyncMock(return_value=_FakeUpdateResult(matched_count=0))
    fake_collection = SimpleNamespace(update_one=update_mock)
    DB.db = {"bible_plan_tracker": fake_collection}

    result = await reset_user_bible_plan("uid-123", "plan-456")

    assert result is False


@pytest.fixture
async def restart_app(monkeypatch):
    app = FastAPI()

    @app.middleware("http")
    async def add_uid(request, call_next):  # type: ignore[override]
        request.state.uid = "test-user"
        return await call_next(request)

    app.include_router(user_bible_plan_routes.auth_bible_plan_router)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


async def test_restart_endpoint_success(monkeypatch, restart_app):
    fake_find = AsyncMock(return_value={"plan_id": "plan-456"})
    fake_reset = AsyncMock(return_value=True)
    monkeypatch.setattr(user_bible_plan_routes, "find_user_plan", fake_find)
    monkeypatch.setattr(user_bible_plan_routes, "reset_user_bible_plan", fake_reset)

    response = await restart_app.post(
        "/my-bible-plans/restart/plan-456",
        json={"start_date": "2026-02-03T10:15:30"},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["success"] is True
    assert "start_date" in body

    fake_find.assert_awaited_once_with("test-user", "plan-456")
    assert fake_reset.await_count == 1
    args, _kwargs = fake_reset.await_args
    assert args[0] == "test-user"
    assert args[1] == "plan-456"
    assert isinstance(args[2], datetime)
    assert args[2].isoformat().startswith("2026-02-03T10:15:30")


async def test_restart_endpoint_requires_subscription(monkeypatch, restart_app):
    fake_find = AsyncMock(return_value=None)
    fake_reset = AsyncMock(return_value=True)
    monkeypatch.setattr(user_bible_plan_routes, "find_user_plan", fake_find)
    monkeypatch.setattr(user_bible_plan_routes, "reset_user_bible_plan", fake_reset)

    response = await restart_app.post("/my-bible-plans/restart/plan-456", json={})

    assert response.status_code == 404
    assert fake_reset.await_count == 0
