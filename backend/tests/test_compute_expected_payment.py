from datetime import datetime, timezone
import uuid

import pytest
import pytest_asyncio
from bson import ObjectId

from controllers.form_payment_controller import compute_expected_payment
from mongo.database import DB


@pytest_asyncio.fixture
async def db_connection():
    if DB.client is not None:
        DB.client.close()
        DB.client = None
        DB.db = None
    await DB.init_db()
    yield
    if DB.client is not None:
        DB.client.close()
        DB.client = None
        DB.db = None


@pytest_asyncio.fixture
async def form_factory(db_connection):
    created_ids: list[ObjectId] = []
    async def _create_form(data, **overrides):
        now = datetime.now(timezone.utc)
        doc = {
            "title": overrides.get("title", f"Payment Test Form {uuid.uuid4().hex[:8]}"),
            "ministries": overrides.get("ministries", []),
            "description": overrides.get("description", ""),
            "user_id": overrides.get("user_id", "test-user"),
            "visible": overrides.get("visible", True),
            "slug": overrides.get("slug"),
            "data": data,
            "created_at": now,
            "updated_at": now,
            "form_width": overrides.get("form_width", "100"),
            "supported_locales": overrides.get("supported_locales", []),
            "requires_payment": overrides.get("requires_payment", True),
            "payment_amount": overrides.get("payment_amount"),
            "payment_type": overrides.get("payment_type", "variable"),
            "payment_description": overrides.get("payment_description"),
            "min_payment_amount": overrides.get("min_payment_amount"),
            "max_payment_amount": overrides.get("max_payment_amount"),
        }

        result = await DB.db.forms.insert_one(doc)
        created_ids.append(result.inserted_id)
        return str(result.inserted_id)

    yield _create_form

    for form_id in created_ids:
        await DB.db.forms.delete_one({"_id": form_id})
        await DB.db.form_responses.delete_many({"form_id": form_id})


@pytest.mark.asyncio
async def test_compute_expected_payment_price_and_checkbox(form_factory):
    form_id = await form_factory(
        [
            {"id": "price_summary", "type": "price", "label": "Summary", "amount": "30"},
            {
                "id": "vip_upgrade",
                "type": "checkbox",
                "name": "vip_upgrade",
                "label": "VIP Upgrade",
                "price": "20",
            },
        ]
    )

    total = await compute_expected_payment(form_id, {"vip_upgrade": True})
    assert total == pytest.approx(50.0)


@pytest.mark.asyncio
async def test_compute_expected_payment_multiselect_options(form_factory):
    form_id = await form_factory(
        [
            {
                "id": "addons",
                "type": "select",
                "name": "addons",
                "label": "Add-ons",
                "multiple": True,
                "options": [
                    {"value": "meal", "label": "Meal", "price": "15.00"},
                    {"value": "parking", "label": "Parking", "price": 10},
                    {"value": "vip", "label": "VIP", "price": "0"},
                ],
            }
        ]
    )

    total = await compute_expected_payment(form_id, {"addons": ["meal", "parking"]})
    assert total == pytest.approx(25.0)


@pytest.mark.asyncio
async def test_compute_expected_payment_hidden_field_ignored(form_factory):
    form_id = await form_factory(
        [
            {
                "id": "need_child_care",
                "type": "checkbox",
                "name": "need_child_care",
                "label": "Need Child Care?",
            },
            {
                "id": "child_care_fee",
                "type": "checkbox",
                "name": "child_care_fee",
                "label": "Child Care",
                "price": "30",
                "visibleIf": "need_child_care == true",
            },
        ]
    )

    total = await compute_expected_payment(
        form_id,
        {"need_child_care": False, "child_care_fee": True},
    )
    assert total == pytest.approx(0.0)


@pytest.mark.asyncio
async def test_compute_expected_payment_invalid_option(form_factory):
    form_id = await form_factory(
        [
            {
                "id": "ticket_type",
                "type": "radio",
                "name": "ticket_type",
                "label": "Ticket Type",
                "options": [
                    {"value": "standard", "label": "Standard", "price": 0},
                    {"value": "vip", "label": "VIP", "price": "25"},
                ],
            }
        ]
    )

    with pytest.raises(ValueError, match="invalid selection"):
        await compute_expected_payment(form_id, {"ticket_type": "bitcoin"})


@pytest.mark.asyncio
async def test_compute_expected_payment_date_pricing(form_factory):
    form_id = await form_factory(
        [
            {
                "id": "camp_dates",
                "type": "date",
                "name": "camp_dates",
                "label": "Camp Dates",
                "mode": "range",
                "pricing": {
                    "enabled": True,
                    "basePerDay": "10",
                    "weekdayOverrides": {"0": "5"},
                    "specificDates": [
                        {"date": "2025-11-15", "price": "20"},
                    ],
                },
            }
        ]
    )

    response = {"camp_dates": {"from": "2025-11-14", "to": "2025-11-16"}}
    total = await compute_expected_payment(form_id, response)
    assert total == pytest.approx(35.0)
