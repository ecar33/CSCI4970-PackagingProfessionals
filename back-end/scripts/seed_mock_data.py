"""
Run from the back-end directory:
    python seed_mock_data.py

Inserts realistic inventory items and 90 days of sale/order_in log history
so analytics parameter changes (days, lead_time, safety_stock) have
meaningful data to work with.

Safe to re-run — skips SKUs that already exist in inventory,
but always appends fresh log entries.
"""

import random
from datetime import datetime, timedelta, timezone

from app import app
from databasemake import Inventory, InventoryLog, db

ITEMS = [
    ("10001", "08x06x04 Box", 60),
    ("10002", "08x08x08 Box", 45),
    ("10003", "10x10x10 Box", 80),
    ("10004", "12x12x12 Box", 30),
    ("10005", "18x18x18 Box", 20),
    ("10006", "20x20x12 Box", 15),
    ("10007", "24x24x24 Box", 10),
    ("10008", "Bubble Wrap Roll", 5),
    ("10009", "Packing Peanuts", 12),
    ("10010", "Tape Roll", 50),
]

# Daily sale rates — vary per item to create interesting analytics spread
DAILY_RATES = {
    "10001": 3.5,
    "10002": 2.8,
    "10003": 4.1,
    "10004": 1.5,
    "10005": 0.8,
    "10006": 0.5,
    "10007": 0.3,
    "10008": 1.2,
    "10009": 0.9,
    "10010": 5.0,
}

HISTORY_DAYS = 90


def seed():
    with app.app_context():
        now = datetime.now(timezone.utc)

        for sku, description, starting_qty in ITEMS:
            existing = db.session.get(Inventory, sku)
            if existing is None:
                db.session.add(
                    Inventory(
                        sku=sku,
                        description=description,
                        item_quantity=starting_qty,
                        return_quantity=0,
                    )
                )
                print(f"  + Added inventory: {sku} {description}")
            else:
                print(f"  ~ Skipped existing: {sku}")

        db.session.flush()

        log_count = 0
        for sku, description, starting_qty in ITEMS:
            rate = DAILY_RATES[sku]
            running_qty = starting_qty

            for day_offset in range(HISTORY_DAYS, 0, -1):
                day = now - timedelta(days=day_offset)

                # Restock every ~3 weeks with some jitter
                if day_offset % random.randint(18, 24) == 0:
                    restock = random.randint(20, 50)
                    running_qty += restock
                    db.session.add(
                        InventoryLog(
                            sku=sku,
                            change_type="order_in",
                            quantity_change=restock,
                            quantity_after=running_qty,
                            timestamp=day.replace(hour=8, minute=0),
                            note="Mock restock",
                        )
                    )
                    log_count += 1

                # Daily sales — Poisson-ish using normal distribution
                sales_today = max(0, round(random.gauss(rate, rate * 0.4)))
                if sales_today > 0 and running_qty > 0:
                    sales_today = min(sales_today, running_qty)
                    running_qty -= sales_today
                    db.session.add(
                        InventoryLog(
                            sku=sku,
                            change_type="sale",
                            quantity_change=-sales_today,
                            quantity_after=running_qty,
                            timestamp=day.replace(
                                hour=random.randint(9, 17), minute=random.randint(0, 59)
                            ),
                            note="Mock sale",
                        )
                    )
                    log_count += 1

            # Update current quantity to reflect simulated history
            item = db.session.get(Inventory, sku)
            if item:
                item.item_quantity = max(running_qty, 0)

        db.session.commit()
        print(f"\nDone — inserted {log_count} log entries across {len(ITEMS)} SKUs.")
        print("Change the analytics lookback (7 / 30 / 90 days) to see different results.")


if __name__ == "__main__":
    seed()
