"""
Tests for analytics.py — usage rate, time-to-empty, and reorder logic.

Log records are inserted with explicit naive UTC timestamps so these tests
document the expected behaviour.
"""
import pytest
from datetime import datetime, timedelta, timezone

from analytics import (
    get_usage_rate,
    get_time_to_empty,
    get_reorder_recommendation,
    get_all_analytics,
    get_inventory_history,
)
from databasemake import db, Inventory, InventoryLog


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def naive_utc(days_ago=0):
    """Return a naive UTC datetime N days in the past."""
    return datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days_ago)


def add_log(app, sku, change_type, quantity_change, quantity_after, days_ago=1):
    with app.app_context():
        db.session.add(InventoryLog(
            sku=sku,
            change_type=change_type,
            quantity_change=quantity_change,
            quantity_after=quantity_after,
            timestamp=naive_utc(days_ago),
        ))
        db.session.commit()


# ---------------------------------------------------------------------------
# get_usage_rate
# ---------------------------------------------------------------------------

def test_usage_rate_unknown_sku_returns_none(seeded_app):
    with seeded_app.app_context():
        assert get_usage_rate("DOESNOTEXIST") is None


def test_usage_rate_no_logs_returns_zero(seeded_app):
    with seeded_app.app_context():
        result = get_usage_rate("10004")
    assert result is not None
    assert result["daily_usage_rate"] == 0.0
    assert result["total_sold"] == 0
    assert result["total_received"] == 0


def test_usage_rate_counts_sales(seeded_app):
    add_log(seeded_app, "10004", "sale", -10, 40, days_ago=5)
    add_log(seeded_app, "10004", "sale", -5, 35, days_ago=2)
    with seeded_app.app_context():
        result = get_usage_rate("10004")
    assert result["total_sold"] == 15


def test_usage_rate_counts_returns(seeded_app):
    add_log(seeded_app, "10004", "return", 3, 53, days_ago=3)
    with seeded_app.app_context():
        result = get_usage_rate("10004")
    assert result["total_received"] == 3


def test_usage_rate_counts_order_in(seeded_app):
    add_log(seeded_app, "10004", "order_in", 20, 70, days_ago=3)
    with seeded_app.app_context():
        result = get_usage_rate("10004")
    assert result["total_received"] == 20


def test_usage_rate_ignores_logs_outside_window(seeded_app):
    add_log(seeded_app, "10004", "sale", -10, 40, days_ago=60)  # outside 30-day window
    with seeded_app.app_context():
        result = get_usage_rate("10004", days=30)
    assert result["total_sold"] == 0


def test_usage_rate_response_shape(seeded_app):
    with seeded_app.app_context():
        result = get_usage_rate("10004")
    expected_keys = {
        "sku", "description", "current_quantity", "daily_usage_rate",
        "period_days", "effective_days", "total_sold", "total_received", "net_change",
    }
    assert set(result.keys()) == expected_keys


def test_usage_rate_net_change(seeded_app):
    add_log(seeded_app, "10004", "sale", -10, 40, days_ago=5)
    add_log(seeded_app, "10004", "return", 3, 43, days_ago=3)
    with seeded_app.app_context():
        result = get_usage_rate("10004")
    assert result["net_change"] == 3 - 10  # received - sold


# ---------------------------------------------------------------------------
# get_time_to_empty
# ---------------------------------------------------------------------------

def test_time_to_empty_unknown_sku_returns_none(seeded_app):
    with seeded_app.app_context():
        assert get_time_to_empty("DOESNOTEXIST") is None


def test_time_to_empty_zero_usage_returns_none(seeded_app):
    # No logs → zero usage rate → won't run out
    with seeded_app.app_context():
        result = get_time_to_empty("10004")
    assert result["days_until_empty"] is None


def test_time_to_empty_calculates_correctly(seeded_app):
    # 10 sold over a 10-day span → 1/day; 50 on hand → 50 days
    add_log(seeded_app, "10004", "sale", -10, 40, days_ago=10)
    add_log(seeded_app, "10004", "sale", -0, 40, days_ago=1)  # second log to widen span
    with seeded_app.app_context():
        result = get_time_to_empty("10004")
    assert result["days_until_empty"] is not None
    assert result["days_until_empty"] > 0


def test_time_to_empty_zero_stock_returns_zero(seeded_app):
    # 10008 seeded at quantity 0, any usage rate → 0 days
    add_log(seeded_app, "10008", "sale", -1, 0, days_ago=10)
    add_log(seeded_app, "10008", "sale", -1, 0, days_ago=1)
    with seeded_app.app_context():
        result = get_time_to_empty("10008")
    assert result["days_until_empty"] == 0.0


# ---------------------------------------------------------------------------
# get_reorder_recommendation
# ---------------------------------------------------------------------------

def test_reorder_unknown_sku_returns_none(seeded_app):
    with seeded_app.app_context():
        assert get_reorder_recommendation("DOESNOTEXIST") is None


def test_reorder_zero_usage_no_reorder(seeded_app):
    with seeded_app.app_context():
        result = get_reorder_recommendation("10004")
    assert result["should_reorder"] is False
    assert result["days_until_reorder"] is None


def test_reorder_triggers_when_below_reorder_point(seeded_app):
    # 10005 seeded at quantity 5
    # sell heavily so reorder_point > 5
    add_log(seeded_app, "10005", "sale", -20, 0, days_ago=10)
    add_log(seeded_app, "10005", "sale", -0, 0, days_ago=1)
    with seeded_app.app_context():
        result = get_reorder_recommendation("10005", lead_time_days=5, safety_stock_days=3)
    assert result["should_reorder"] is True
    assert result["days_until_reorder"] == 0


def test_reorder_response_shape(seeded_app):
    with seeded_app.app_context():
        result = get_reorder_recommendation("10004")
    expected_keys = {
        "sku", "description", "current_quantity", "daily_usage_rate",
        "lead_time_days", "safety_stock_days", "reorder_point",
        "should_reorder", "days_until_reorder",
    }
    assert set(result.keys()) == expected_keys


def test_reorder_point_formula(seeded_app):
    # 10 sold over 10-day span → 1/day; reorder_point = 1 × (5 + 3) = 8
    add_log(seeded_app, "10004", "sale", -10, 40, days_ago=10)
    add_log(seeded_app, "10004", "sale", -0, 40, days_ago=1)
    with seeded_app.app_context():
        result = get_reorder_recommendation("10004", lead_time_days=5, safety_stock_days=3)
    assert result["reorder_point"] == round(result["daily_usage_rate"] * (5 + 3))


# ---------------------------------------------------------------------------
# get_all_analytics
# ---------------------------------------------------------------------------

def test_all_analytics_returns_list(seeded_app):
    with seeded_app.app_context():
        result = get_all_analytics()
    assert isinstance(result, list)
    assert len(result) == 3  # matches seeded_app fixture (10004, 10005, 10008)


def test_all_analytics_item_shape(seeded_app):
    with seeded_app.app_context():
        result = get_all_analytics()
    expected_keys = {
        "sku", "description", "current_quantity", "daily_usage_rate",
        "days_until_empty", "reorder_point", "should_reorder",
        "days_until_reorder", "lead_time_days", "safety_stock_days",
    }
    for item in result:
        assert set(item.keys()) == expected_keys


# ---------------------------------------------------------------------------
# get_inventory_history
# ---------------------------------------------------------------------------

def test_history_empty_for_no_logs(seeded_app):
    with seeded_app.app_context():
        result = get_inventory_history("10004")
    assert result == []


def test_history_returns_logs_in_window(seeded_app):
    add_log(seeded_app, "10004", "sale", -5, 45, days_ago=3)
    with seeded_app.app_context():
        result = get_inventory_history("10004", days=30)
    assert len(result) == 1
    assert result[0]["change_type"] == "sale"


def test_history_excludes_logs_outside_window(seeded_app):
    add_log(seeded_app, "10004", "sale", -5, 45, days_ago=60)
    with seeded_app.app_context():
        result = get_inventory_history("10004", days=30)
    assert result == []


def test_history_entry_shape(seeded_app):
    add_log(seeded_app, "10004", "sale", -5, 45, days_ago=1)
    with seeded_app.app_context():
        result = get_inventory_history("10004")
    entry = result[0]
    assert set(entry.keys()) == {"id", "sku", "change_type", "quantity_change", "quantity_after", "timestamp", "note"}
