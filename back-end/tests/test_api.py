"""
Tests for Flask API endpoints:
  GET  /api/health
  GET  /api/inventory
  PATCH /api/inventory/<sku>
  POST /api/csv/upload
"""

import io
import json

# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


def test_health_returns_ok(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.get_json() == {"status": "ok"}


# ---------------------------------------------------------------------------
# GET /api/inventory
# ---------------------------------------------------------------------------


def test_get_inventory_empty(client):
    response = client.get("/api/inventory")
    assert response.status_code == 200
    assert response.get_json() == []


def test_get_inventory_returns_seeded_items(seeded_client):
    response = seeded_client.get("/api/inventory")
    assert response.status_code == 200
    data = response.get_json()
    assert len(data) == 3
    skus = {item["sku"] for item in data}
    assert skus == {"10004", "10005", "10008"}


def test_get_inventory_item_shape(seeded_client):
    data = seeded_client.get("/api/inventory").get_json()
    item = next(i for i in data if i["sku"] == "10004")
    assert set(item.keys()) == {"sku", "description", "item_quantity", "return_quantity"}
    assert item["item_quantity"] == 50


# ---------------------------------------------------------------------------
# PATCH /api/inventory/<sku>
# ---------------------------------------------------------------------------


def test_patch_inventory_updates_quantity(seeded_client):
    response = seeded_client.patch(
        "/api/inventory/10004",
        data=json.dumps({"item_quantity": 99}),
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.get_json()["item_quantity"] == 99


def test_patch_inventory_clamps_negative_to_zero(seeded_client):
    response = seeded_client.patch(
        "/api/inventory/10004",
        data=json.dumps({"item_quantity": -5}),
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.get_json()["item_quantity"] == 0


def test_patch_inventory_unknown_sku_returns_404(seeded_client):
    response = seeded_client.patch(
        "/api/inventory/DOESNOTEXIST",
        data=json.dumps({"item_quantity": 10}),
        content_type="application/json",
    )
    assert response.status_code == 404


def test_patch_inventory_bad_quantity_returns_400(seeded_client):
    response = seeded_client.patch(
        "/api/inventory/10004",
        data=json.dumps({"item_quantity": "not-a-number"}),
        content_type="application/json",
    )
    assert response.status_code == 400


def test_patch_inventory_updates_description(seeded_client):
    response = seeded_client.patch(
        "/api/inventory/10004",
        data=json.dumps({"description": "Updated Box"}),
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.get_json()["description"] == "Updated Box"


def test_patch_inventory_empty_description_returns_400(seeded_client):
    response = seeded_client.patch(
        "/api/inventory/10004",
        data=json.dumps({"description": "   "}),
        content_type="application/json",
    )
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# POST /api/csv/upload
# ---------------------------------------------------------------------------

VALID_CSV = (
    "SKU,ShortDescription,ItemSalesUnitCount,ItemReturnUnitCount\n"
    "10004,10x10x10 Box,3,0\n"
    "10005,12x12x12 Box,2,1\n"
)


def test_csv_upload_returns_parsed_items(seeded_client):
    data = {"file": (io.BytesIO(VALID_CSV.encode()), "sales.csv")}
    response = seeded_client.post(
        "/api/csv/upload",
        data=data,
        content_type="multipart/form-data",
    )
    assert response.status_code == 200
    body = response.get_json()
    assert body["file"] == "sales.csv"
    assert len(body["items"]) == 2


def test_csv_upload_decrements_inventory(seeded_client):
    data = {"file": (io.BytesIO(VALID_CSV.encode()), "sales.csv")}
    seeded_client.post("/api/csv/upload", data=data, content_type="multipart/form-data")

    inventory = seeded_client.get("/api/inventory").get_json()
    item_10004 = next(i for i in inventory if i["sku"] == "10004")
    # started at 50, sold 3
    assert item_10004["item_quantity"] == 47


def test_csv_upload_does_not_go_below_zero(seeded_client):
    # 10008 starts at 0, CSV sells 5 more
    csv_data = (
        "SKU,ShortDescription,ItemSalesUnitCount,ItemReturnUnitCount\n10008,18x18x18 Box,5,0\n"
    )
    data = {"file": (io.BytesIO(csv_data.encode()), "sales.csv")}
    seeded_client.post("/api/csv/upload", data=data, content_type="multipart/form-data")

    inventory = seeded_client.get("/api/inventory").get_json()
    item = next(i for i in inventory if i["sku"] == "10008")
    assert item["item_quantity"] == 0


def test_csv_upload_no_file_returns_400(seeded_client):
    response = seeded_client.post("/api/csv/upload", data={}, content_type="multipart/form-data")
    assert response.status_code == 400


def test_csv_upload_wrong_extension_returns_400(seeded_client):
    data = {"file": (io.BytesIO(b"data"), "sales.txt")}
    response = seeded_client.post(
        "/api/csv/upload",
        data=data,
        content_type="multipart/form-data",
    )
    assert response.status_code == 400


def test_csv_upload_applies_returns(seeded_client):
    csv_data = (
        "SKU,ShortDescription,ItemSalesUnitCount,ItemReturnUnitCount\n10005,12x12x12 Box,0,3\n"
    )
    data = {"file": (io.BytesIO(csv_data.encode()), "sales.csv")}
    seeded_client.post("/api/csv/upload", data=data, content_type="multipart/form-data")

    inventory = seeded_client.get("/api/inventory").get_json()
    item = next(i for i in inventory if i["sku"] == "10005")
    # started at 5, 3 returns added
    assert item["item_quantity"] == 8
    assert item["return_quantity"] == 3
