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


def init_db(app: Flask) -> None:
    db.init_app(app)

    with app.app_context():
        db.create_all()


if __name__ == "__main__":
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///inv.db"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    init_db(app)
