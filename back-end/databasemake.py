from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


db = SQLAlchemy(model_class=Base)


class Inventory(db.Model):
    __tablename__ = "inventory"

    sku: Mapped[str] = mapped_column(primary_key=True)
    description: Mapped[str] = mapped_column(nullable=False)
    item_quantity: Mapped[int] = mapped_column(nullable=False, default=0)
    return_quantity: Mapped[int] = mapped_column(nullable=False, default=0)


# Add all items you want to track here. They will only be inserted if
# the SKU does not already exist in the database.
SEED_ITEMS = [
    {"sku": "10064", "description": "15x12x10 Box"},
    {"sku": "10260", "description": "Size #7- 14.5x20 Bubble Mailer"},
    {"sku": "10150", "description": "20x12x12 Box"},
    {"sku": "10052", "description": "08x06x04 Box"},
    {"sku": "10004", "description": "10x10x10 Box"},
    {"sku": "101327", "description": "17x17x08 laptop Box w/Insert"},
    {"sku": "10251", "description": "Size #00- 5x10 Bubble Mailer"},
    {"sku": "10005", "description": "12x12x12 Box"},
    {"sku": "10061", "description": "13x11x05 Box"},
    {"sku": "10008", "description": "18x18x18 Box"},
    {"sku": "10152", "description": "20x20x12 Box"},
    {"sku": "10254", "description": "Size #2- 8.5x12 Bubble Mailer"},
    {"sku": "20587", "description": "12x09x03 Box"},
    {"sku": "101381", "description": "20x16x14 Box"},
    {"sku": "10011", "description": "24x24x24 Box"},
    {"sku": "10257", "description": "Size #5- 10.5x16 Bubble Mailer"},
    {"sku": "10006", "description": "14x14x14 Box"},
    {"sku": "101313", "description": "16x16x04 Box"},
    {"sku": "10001", "description": "06x06x06 Box"},
    {"sku": "101418", "description": "24x12x12 Box"},
    {"sku": "10078", "description": "06x06x48 Box"},
    {"sku": "10007", "description": "16x16x16 Box"},
    {"sku": "10002", "description": "08x08x08 Box"},
    {"sku": "20586", "description": "Smartphone Pocket Wrap"},
    {"sku": "114719", "description": "14x17 Branded Shipping Pak (Medium)"},
    {"sku": "110830", "description": "Photo Mailer LG"},
    {"sku": "10304", "description": "3/16-16\"x9' Bubble"},
    {"sku": "10300", "description": "5/16-16\"x5' Bubble"},
    {"sku": "10357", "description": "Photo w/Corrugated Inserts- 11.5x14.25"},
    {"sku": "10610", "description": "Medium-width x 800 Crystal Clear"},
    {"sku": "110831", "description": "Photo Mailer Med"},
    {"sku": "10390", "description": "Photo w/Corrugated Inserts- 9x12"},
    {"sku": "110832", "description": "Photo Mailer SM"},
]


def seed_db() -> None:
    """Insert seed items that don't already exist in the inventory table."""
    for item in SEED_ITEMS:
        existing = db.session.get(Inventory, item["sku"])
        if existing is None:
            db.session.add(Inventory(
                sku=item["sku"],
                description=item["description"],
                item_quantity=0,
                return_quantity=0,
            ))
    db.session.commit()


def init_db(app: Flask) -> None:
    db.init_app(app)

    with app.app_context():
        db.create_all()
        seed_db()


if __name__ == "__main__":
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///inv.db"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    init_db(app)
