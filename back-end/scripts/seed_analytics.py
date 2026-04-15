"""
Seed script for testing analytics. Populates inventory + log entries that
exercise the four scenarios visible in the Analytics view:

  - Reorder Now  : high daily usage, stock already at/below reorder point
  - Due Soon     : moderate usage, reorder point reached within 7 days
  - OK           : low usage, plenty of stock
  - No Data      : no log entries at all (usage rate = 0 / no data)

Run from the back-end directory:
  python seed_analytics.py [--clear]

  --clear  Wipe all existing inventory_log rows before inserting new ones.
           Does NOT touch inventory quantities unless a SKU doesn't exist yet.
"""

import argparse
import os
from datetime import datetime, timezone, timedelta
import random

from dotenv import load_dotenv
load_dotenv()

from flask import Flask
from databasemake import db, Inventory, InventoryLog, SEED_ITEMS

# ---------------------------------------------------------------------------
# Scenarios: (sku, starting_qty, daily_sales, daily_receives)
# SKUs are pulled from the real SEED_ITEMS list so they always exist.
# ---------------------------------------------------------------------------
SCENARIOS = [
    # Reorder Now — burns through ~10/day, only 30 left, reorder point ~80
    {"sku": "10004",  "label": "Reorder Now",  "qty": 30,  "daily_sales": 10, "daily_receives": 1},
    {"sku": "10005",  "label": "Reorder Now",  "qty": 20,  "daily_sales": 8,  "daily_receives": 0},

    # Due Soon — ~4/day usage, ~35 left, reorder point ~56; runs out in ~9d
    {"sku": "10008",  "label": "Due Soon",     "qty": 35,  "daily_sales": 4,  "daily_receives": 1},
    {"sku": "10152",  "label": "Due Soon",     "qty": 28,  "daily_sales": 3,  "daily_receives": 0},

    # OK — very low usage, lots of stock
    {"sku": "10011",  "label": "OK",           "qty": 200, "daily_sales": 1,  "daily_receives": 3},
    {"sku": "10007",  "label": "OK",           "qty": 150, "daily_sales": 2,  "daily_receives": 4},
    {"sku": "10001",  "label": "OK",           "qty": 180, "daily_sales": 1,  "daily_receives": 2},

    # No Data — inventory exists but zero log entries (usage rate will show 0 / no data)
    {"sku": "10260",  "label": "No Data",      "qty": 50,  "daily_sales": 0,  "daily_receives": 0},
    {"sku": "10251",  "label": "No Data",      "qty": 50,  "daily_sales": 0,  "daily_receives": 0},
]

LOOKBACK_DAYS = 30


def build_app() -> Flask:
    app = Flask(__name__)
    uri = os.environ.get("DATABASE_URL", "sqlite:////app/data/inv.db")
    app.config["SQLALCHEMY_DATABASE_URI"] = uri
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    db.init_app(app)
    return app


def ensure_inventory_items() -> None:
    """Make sure every SKU in SEED_ITEMS exists in the inventory table."""
    seed_map = {s["sku"]: s["description"] for s in SEED_ITEMS}
    for sku, description in seed_map.items():
        if db.session.get(Inventory, sku) is None:
            db.session.add(Inventory(sku=sku, description=description,
                                     item_quantity=50, return_quantity=0))
    db.session.flush()


def clear_logs() -> None:
    deleted = db.session.query(InventoryLog).delete()
    print(f"  Cleared {deleted} existing log rows.")


def generate_logs_for_scenario(scenario: dict) -> None:
    sku = scenario["sku"]
    qty = scenario["qty"]
    daily_sales = scenario["daily_sales"]
    daily_receives = scenario["daily_receives"]

    if daily_sales == 0 and daily_receives == 0:
        # No Data scenario — just set quantity, no logs
        item = db.session.get(Inventory, sku)
        item.item_quantity = qty
        print(f"  [{scenario['label']:12s}] {sku} — no logs, qty={qty}")
        return

    now = datetime.now(timezone.utc)
    running_qty = qty

    # Spread events across the lookback window, one batch per day
    for day_offset in range(LOOKBACK_DAYS, 0, -1):
        ts_base = now - timedelta(days=day_offset)

        # Sales (negative quantity_change)
        if daily_sales > 0:
            # small jitter so it doesn't look perfectly uniform
            sold = max(0, daily_sales + random.randint(-1, 1))
            if sold > 0 and running_qty > 0:
                sold = min(sold, running_qty)
                running_qty -= sold
                ts = ts_base.replace(
                    hour=random.randint(9, 17),
                    minute=random.randint(0, 59),
                    second=0, microsecond=0,
                )
                db.session.add(InventoryLog(
                    sku=sku,
                    change_type="sale",
                    quantity_change=-sold,
                    quantity_after=running_qty,
                    timestamp=ts,
                    note="seed",
                ))

        # Receives (positive quantity_change)
        if daily_receives > 0 and random.random() < 0.4:  # ~40% of days get a receive
            received = daily_receives + random.randint(0, 2)
            running_qty += received
            ts = ts_base.replace(
                hour=random.randint(8, 12),
                minute=random.randint(0, 59),
                second=0, microsecond=0,
            )
            db.session.add(InventoryLog(
                sku=sku,
                change_type="order_in",
                quantity_change=received,
                quantity_after=running_qty,
                timestamp=ts,
                note="seed",
            ))

    # Set the current inventory quantity to where simulation ended
    item = db.session.get(Inventory, sku)
    item.item_quantity = max(0, running_qty)

    approx_daily = daily_sales
    print(f"  [{scenario['label']:12s}] {sku} — ~{approx_daily}/day sales, final qty={item.item_quantity}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed analytics test data.")
    parser.add_argument("--clear", action="store_true",
                        help="Clear all existing log rows before seeding.")
    args = parser.parse_args()

    app = build_app()

    with app.app_context():
        db.create_all()
        ensure_inventory_items()

        if args.clear:
            clear_logs()

        print(f"\nGenerating {LOOKBACK_DAYS}-day log history for {len(SCENARIOS)} scenarios...\n")
        random.seed(42)  # reproducible output

        for scenario in SCENARIOS:
            generate_logs_for_scenario(scenario)

        db.session.commit()
        print("\nDone. Re-run with --clear to reset logs and reseed.")


if __name__ == "__main__":
    main()
