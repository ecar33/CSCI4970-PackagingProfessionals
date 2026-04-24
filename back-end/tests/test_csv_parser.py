"""
Unit tests for csv_parser.parse_sales_csv.
No database or Flask app needed — pure logic tests on CSV parsing and field extraction.
"""

import io
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from csv_parser import parse_sales_csv


def _stream(text: str):
    """Wrap a string as a binary file-like object the way Flask would."""
    return io.BytesIO(text.encode("utf-8"))


HEADER = "SKU,ShortDescription,ItemSalesUnitCount,ItemReturnUnitCount\n"


def test_parse_returns_correct_shape():
    csv = HEADER + "10004,10x10x10 Box,5,1\n"
    result = parse_sales_csv(_stream(csv))
    assert len(result) == 1
    row = result[0]
    assert row["sku"] == "10004"
    assert row["description"] == "10x10x10 Box"
    assert row["sales_count"] == 5
    assert row["return_count"] == 1


def test_parse_multiple_rows():
    csv = HEADER + "10004,10x10x10 Box,3,0\n10005,12x12x12 Box,2,1\n"
    result = parse_sales_csv(_stream(csv))
    assert len(result) == 2


def test_parse_empty_csv_returns_empty_list():
    result = parse_sales_csv(_stream(HEADER))
    assert result == []


def test_parse_skips_malformed_row():
    # row with empty numeric fields — int("") raises ValueError, parser skips it
    csv = HEADER + "10004,10x10x10 Box,,\n10005,12x12x12 Box,2,1\n"
    result = parse_sales_csv(_stream(csv))
    # only the valid row should be returned
    assert len(result) == 1
    assert result[0]["sku"] == "10005"


def test_parse_handles_utf8_bom():
    # Excel sometimes saves CSVs with a UTF-8 BOM (\ufeff)
    csv = "\ufeff" + HEADER + "10004,10x10x10 Box,5,1\n"
    result = parse_sales_csv(_stream(csv))
    assert len(result) == 1
    assert result[0]["sku"] == "10004"


def test_parse_strips_whitespace_from_fields():
    csv = HEADER + "  10004 , 10x10x10 Box , 5 , 1 \n"
    result = parse_sales_csv(_stream(csv))
    assert result[0]["sku"] == "10004"
    assert result[0]["description"] == "10x10x10 Box"


def test_parse_zero_sales_and_returns():
    csv = HEADER + "10004,10x10x10 Box,0,0\n"
    result = parse_sales_csv(_stream(csv))
    assert result[0]["sales_count"] == 0
    assert result[0]["return_count"] == 0


def test_parse_skips_row_with_non_numeric_count():
    csv = HEADER + "10004,10x10x10 Box,FIVE,1\n"
    result = parse_sales_csv(_stream(csv))
    assert result == []
