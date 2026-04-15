"""
Unit tests for ocr.parse_boxes_from_text.
No PDF, Tesseract, or Flask needed — pure logic tests on dimension regex matching and quantity extraction.
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from ocr import parse_boxes_from_text

def test_basic_lowercase_dimensions():
    text = "18x18x18  25"
    result = parse_boxes_from_text(text)
    assert len(result) == 1
    assert result[0]["box_size"] == "18x18x18"
    assert result[0]["count"] == 25


def test_uppercase_dimensions():
    text = "12X10X6  10"
    result = parse_boxes_from_text(text)
    assert result[0]["box_size"] == "12x10x6"
    assert result[0]["count"] == 10


def test_spaces_around_x():
    text = "18 x 18 x 18  50"
    result = parse_boxes_from_text(text)
    assert result[0]["box_size"] == "18x18x18"
    assert result[0]["count"] == 50


def test_quantity_is_last_number_on_line():
    # Line has multiple numbers — count should be the last one
    text = "Order #4521  18x18x18  Qty: 30"
    result = parse_boxes_from_text(text)
    assert result[0]["count"] == 30


def test_multiple_lines():
    text = "12x12x12  10\n18x18x18  25\n24x24x24  5"
    result = parse_boxes_from_text(text)
    assert len(result) == 3
    assert result[0]["box_size"] == "12x12x12"
    assert result[1]["box_size"] == "18x18x18"
    assert result[2]["box_size"] == "24x24x24"


def test_non_box_lines_ignored():
    text = "Invoice #1234\nShip to: Store 4166\n10x10x10  15\nThank you"
    result = parse_boxes_from_text(text)
    assert len(result) == 1
    assert result[0]["box_size"] == "10x10x10"


def test_empty_string_returns_empty_list():
    assert parse_boxes_from_text("") == []


def test_no_box_dimensions_returns_empty_list():
    text = "Invoice #1234\nTotal: 5 items\nShip date: 04/14/2026"
    assert parse_boxes_from_text(text) == []


def test_asymmetric_dimensions():
    text = "6x4x3  8"
    result = parse_boxes_from_text(text)
    assert result[0]["box_size"] == "6x4x3"
    assert result[0]["count"] == 8
