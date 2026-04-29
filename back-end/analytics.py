"""
@brief Analytics module for computing inventory usage rates, time-to-empty
       projections, and optimal reorder timing.
"""

import logging
from datetime import datetime, timedelta, timezone

from databasemake import Inventory, InventoryLog, db

logger = logging.getLogger(__name__)

# Default assumed delivery lead time in days (can be overridden per request)
DEFAULT_LEAD_TIME_DAYS = 5


def get_usage_rate(sku: str, days: int = 30) -> dict:
    """
    @brief Compute the average daily usage rate for a single SKU over the
           last `days` days, based on logged sale events.

    @param sku The SKU to analyse
    @param days Look-back window in days (default 30)

    @return dict with sku, description, daily_usage_rate, period_days,
            total_sold, total_received, net_change
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    item = db.session.get(Inventory, sku)
    if item is None:
        return None

    logs = (
        db.session.query(InventoryLog)
        .filter(InventoryLog.sku == sku, InventoryLog.timestamp >= cutoff)
        .order_by(InventoryLog.timestamp.asc())
        .all()
    )

    total_sold = 0
    total_received = 0
    for log in logs:
        if log.change_type == "sale":
            total_sold += abs(log.quantity_change)
        elif log.change_type in ("order_in", "return"):
            total_received += abs(log.quantity_change)

    # If we have log entries, use the actual time span for more accuracy
    if logs:
        first_ts = logs[0].timestamp
        last_ts = logs[-1].timestamp
        actual_span = (last_ts - first_ts).total_seconds() / 86400
        effective_days = max(actual_span, 1)  # at least 1 day
    else:
        effective_days = days

    daily_usage = total_sold / effective_days if effective_days > 0 else 0

    return {
        "sku": sku,
        "description": item.description,
        "current_quantity": item.item_quantity,
        "daily_usage_rate": round(daily_usage, 2),
        "period_days": days,
        "effective_days": round(effective_days, 1),
        "total_sold": total_sold,
        "total_received": total_received,
        "net_change": total_received - total_sold,
    }


def get_time_to_empty(sku: str, days: int = 30) -> dict:
    """
    @brief Estimate how many days until the item runs out of stock based on
           recent usage rate.

    @param sku The SKU to analyse
    @param days Look-back window for computing usage rate

    @return dict with sku, description, current_quantity, daily_usage_rate,
            days_until_empty (None if usage is 0)
    """
    usage = get_usage_rate(sku, days)
    if usage is None:
        return None

    rate = usage["daily_usage_rate"]
    current = usage["current_quantity"]

    if rate <= 0:
        days_until_empty = None  # no usage → won't run out
    else:
        days_until_empty = round(current / rate, 1)

    return {
        "sku": usage["sku"],
        "description": usage["description"],
        "current_quantity": current,
        "daily_usage_rate": rate,
        "days_until_empty": days_until_empty,
    }


def get_reorder_recommendation(
    sku: str,
    days: int = 30,
    lead_time_days: float = DEFAULT_LEAD_TIME_DAYS,
    safety_stock_days: float = 3,
) -> dict:
    """
    @brief Recommend when to reorder and how much, using a simple
           reorder-point model:
             reorder_point = daily_usage × (lead_time + safety_stock_days)

    @param sku SKU to analyse
    @param days Look-back window for usage rate
    @param lead_time_days Expected delivery lead time in days
    @param safety_stock_days Extra buffer days of stock to keep on hand

    @return dict with sku, description, current_quantity, daily_usage_rate,
            reorder_point, should_reorder, days_until_reorder
    """
    usage = get_usage_rate(sku, days)
    if usage is None:
        return None

    rate = usage["daily_usage_rate"]
    current = usage["current_quantity"]

    reorder_point = round(rate * (lead_time_days + safety_stock_days))

    if rate <= 0:
        days_until_reorder = None
        should_reorder = False
    else:
        if current <= reorder_point:
            should_reorder = True
            days_until_reorder = 0
        else:
            should_reorder = False
            days_until_reorder = round((current - reorder_point) / rate, 1)

    return {
        "sku": usage["sku"],
        "description": usage["description"],
        "current_quantity": current,
        "daily_usage_rate": rate,
        "lead_time_days": lead_time_days,
        "safety_stock_days": safety_stock_days,
        "reorder_point": reorder_point,
        "should_reorder": should_reorder,
        "days_until_reorder": days_until_reorder,
    }


def get_all_analytics(
    days: int = 30, lead_time_days: float = DEFAULT_LEAD_TIME_DAYS, safety_stock_days: float = 3
) -> list:
    """
    @brief Return analytics for every item in the inventory table.

    @param days Look-back window
    @param lead_time_days Delivery lead time in days
    @param safety_stock_days Safety buffer in days

    @return list of dicts, one per SKU, combining usage rate, time-to-empty,
            and reorder recommendation data
    """
    items = db.session.query(Inventory).order_by(Inventory.description.asc()).all()
    results = []

    for item in items:
        tte = get_time_to_empty(item.sku, days)
        reorder = get_reorder_recommendation(item.sku, days, lead_time_days, safety_stock_days)
        if tte is None or reorder is None:
            continue

        results.append(
            {
                "sku": item.sku,
                "description": item.description,
                "current_quantity": item.item_quantity,
                "daily_usage_rate": tte["daily_usage_rate"],
                "days_until_empty": tte["days_until_empty"],
                "reorder_point": reorder["reorder_point"],
                "should_reorder": reorder["should_reorder"],
                "days_until_reorder": reorder["days_until_reorder"],
                "lead_time_days": lead_time_days,
                "safety_stock_days": safety_stock_days,
            }
        )

    return results


def get_inventory_history(sku: str, days: int = 30) -> list:
    """
    @brief Return the raw inventory log entries for a SKU over the last
           `days` days, useful for graphing inventory level over time.

    @param sku The SKU to query
    @param days Look-back window

    @return list of dicts with timestamp, change_type, quantity_change,
            quantity_after, note
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    logs = (
        db.session.query(InventoryLog)
        .filter(InventoryLog.sku == sku, InventoryLog.timestamp >= cutoff)
        .order_by(InventoryLog.timestamp.asc())
        .all()
    )

    return [
        {
            "id": log.id,
            "sku": log.sku,
            "change_type": log.change_type,
            "quantity_change": log.quantity_change,
            "quantity_after": log.quantity_after,
            "timestamp": log.timestamp.isoformat(),
            "note": log.note,
        }
        for log in logs
    ]
