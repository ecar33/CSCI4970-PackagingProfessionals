import os
from unittest.mock import MagicMock, patch

# Must be set before app.py is imported — it reads this at module load time
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

# Patch the watcher before import so it doesn't try to watch /app/orders
with patch("watcher.start_watcher", return_value=MagicMock()):
    from app import app as flask_app

import pytest
from databasemake import db, Inventory


@pytest.fixture
def app():
    flask_app.config["TESTING"] = True
    flask_app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"

    with flask_app.app_context():
        db.create_all()
        yield flask_app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def seeded_app(app):
    """App with a small set of known inventory items pre-loaded."""
    with app.app_context():
        db.session.merge(Inventory(sku="10004", description="10x10x10 Box", item_quantity=50, return_quantity=0))
        db.session.merge(Inventory(sku="10005", description="12x12x12 Box", item_quantity=5, return_quantity=0))
        db.session.merge(Inventory(sku="10008", description="18x18x18 Box", item_quantity=0, return_quantity=0))
        db.session.commit()
    return app


@pytest.fixture
def seeded_client(seeded_app):
    return seeded_app.test_client()
