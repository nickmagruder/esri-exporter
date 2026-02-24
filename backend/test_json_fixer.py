#!/usr/bin/env python3
"""Unit tests for fix_malformed_json() and generate_sql() in app.py.

Run with pytest:
    pytest test_json_fixer.py -v

Or directly:
    python test_json_fixer.py
"""

import os
import json
from app import fix_malformed_json, generate_sql

SAMPLE_FILE = os.path.join(os.path.dirname(__file__), "seattle short.txt")


def _load_sample_records():
    """Parse sample WSDOT data through fix_malformed_json and return as list of dicts."""
    with open(SAMPLE_FILE, "r") as f:
        raw = f.read()
    return json.loads(fix_malformed_json(raw))


# ---------------------------------------------------------------------------
# Existing fix_malformed_json tests
# ---------------------------------------------------------------------------

def test_json_fixer():
    """Test the JSON fixer function with various malformed JSON examples"""

    print("Testing JSON Fixer Function\n")

    # Test 1: Double-encoded JSON (like the seattle.json case)
    double_encoded = '"[{\\"ColliRptNum\\": \\"3838031\\", \\"Jurisdiction\\": \\"City Street\\", \\"CityName\\": \\"Seattle\\"}]"'
    print("Test 1: Double-encoded JSON")
    print("Input:", double_encoded)
    try:
        result = fix_malformed_json(double_encoded)
        print("Output:")
        print(result)
        print()
    except Exception as e:
        print(f"Error: {e}\n")

    # Test 2: Simple malformed JSON with extra escaping
    malformed_simple = '{"name": "John", "city": "Seattle"}'
    print("Test 2: Simple JSON (should work as-is)")
    print("Input:", malformed_simple)
    try:
        result = fix_malformed_json(malformed_simple)
        print("Output:")
        print(result)
        print()
    except Exception as e:
        print(f"Error: {e}\n")

    # Test 3: JSON string that's been stringified
    stringified_json = '"{\\"name\\": \\"Alice\\", \\"age\\": 30}"'
    print("Test 3: Stringified JSON")
    print("Input:", stringified_json)
    try:
        result = fix_malformed_json(stringified_json)
        print("Output:")
        print(result)
        print()
    except Exception as e:
        print(f"Error: {e}\n")

    print("Testing complete!")


# ---------------------------------------------------------------------------
# generate_sql tests
# ---------------------------------------------------------------------------

def test_generate_sql_basic_mapping():
    """Output SQL maps WSDOT fields to CrashMap columns per the field mapping spec."""
    records = _load_sample_records()
    assert len(records) == 7, f"Expected 7 sample records, got {len(records)}"

    sql = generate_sql(records, mode="Bicyclist")

    # Header block
    assert "-- Mode: Bicyclist" in sql
    assert "-- Records: 7" in sql

    # Column list is present and double-quoted
    assert '"ColliRptNum"' in sql
    assert '"StateOrProvinceName"' in sql
    assert '"CrashDate"' in sql
    assert '"geom"' in sql

    # First record field values (ColliRptNum 3838031)
    assert "'3838031'" in sql
    assert "'City Street'" in sql           # Jurisdiction
    assert "'Washington'" in sql            # StateOrProvinceName hardcoded
    assert "'King'" in sql                  # CountyName
    assert "'Seattle'" in sql              # CityName
    assert "'2025-02-21T00:00:00'" in sql   # FullDate as-is
    assert "'2025-02-21'" in sql            # CrashDate (date portion only)
    assert "'11:06 AM'" in sql              # FullTime
    assert "'Suspected Minor Injury'" in sql  # MostSevereInjuryType
    assert "'Bicyclist'" in sql             # Mode from UI

    # geom: ST_MakePoint(longitude, latitude) — longitude first
    assert "ST_SetSRID(ST_MakePoint(-122.316864546986, 47.615677169795), 4326)" in sql

    # Conflict clause
    assert 'ON CONFLICT ("ColliRptNum") DO NOTHING' in sql

    # Dropped columns must not appear anywhere
    assert "CrashStatePlaneX" not in sql
    assert "CrashStatePlaneY" not in sql


def test_generate_sql_null_coercion_region_placeholder():
    """RegionName containing only a bare apostrophe is coerced to NULL."""
    rec = {
        "ColliRptNum": "R001",
        "Jurisdiction": "City Street",
        "RegionName": "'",     # WSDOT placeholder — must become NULL
        "CountyName": "King",
        "CityName": "Seattle",
        "FullDate": "2025-01-01T00:00:00",
        "FullTime": "12:00 PM",
        "MostSevereInjuryType": "No Injury",
        "AgeGroup": "Adult",
        "InvolvedPersons": 1,
        "Latitude": 47.0,
        "Longitude": -122.0,
    }
    sql = generate_sql([rec], mode="Pedestrian")

    # NULL must appear (for RegionName)
    assert "NULL" in sql

    # The apostrophe placeholder must not be inserted as a quoted string ('''')
    assert "''''" not in sql


def test_generate_sql_null_coercion_age_group_empty():
    """Empty AgeGroup string is coerced to NULL."""
    rec = {
        "ColliRptNum": "A001",
        "Jurisdiction": "City Street",
        "RegionName": "Northwest",
        "CountyName": "King",
        "CityName": "Seattle",
        "FullDate": "2025-01-01T00:00:00",
        "FullTime": "12:00 PM",
        "MostSevereInjuryType": "No Injury",
        "AgeGroup": "",        # Empty string — must become NULL
        "InvolvedPersons": 1,
        "Latitude": 47.0,
        "Longitude": -122.0,
    }
    sql = generate_sql([rec], mode="Pedestrian")

    # NULL must appear (for AgeGroup)
    assert "NULL" in sql

    # An empty quoted string should not appear
    assert "''" not in sql


def test_generate_sql_string_escaping():
    """Single quotes inside string values are doubled for SQL safety."""
    rec = {
        "ColliRptNum": "E001",
        "Jurisdiction": "State's Road",   # apostrophe in Jurisdiction
        "RegionName": "O'Brien Region",   # apostrophe in RegionName
        "CountyName": "King",
        "CityName": "O'Brien",            # apostrophe in CityName
        "FullDate": "2025-06-15T00:00:00",
        "FullTime": "3:00 PM",
        "MostSevereInjuryType": "No Injury",
        "AgeGroup": "Adult",
        "InvolvedPersons": 2,
        "Latitude": 48.0,
        "Longitude": -121.0,
    }
    sql = generate_sql([rec], mode="Pedestrian")

    assert "'State''s Road'" in sql
    assert "'O''Brien Region'" in sql
    assert "'O''Brien'" in sql

    # Raw unescaped apostrophes must not appear inside quoted strings
    # (the only apostrophes should be the SQL delimiters or doubled pairs)
    assert "State's" not in sql
    assert "O'Brien'" not in sql or "'O''Brien'" in sql  # doubled form is present


def test_generate_sql_batch_splitting():
    """Records are split into multiple INSERT statements at the batch boundary."""
    records = _load_sample_records()  # 7 records
    sql = generate_sql(records, mode="Bicyclist", batch_size=3)

    # 7 records at batch_size=3 → batches of [3, 3, 1] → 3 INSERT statements
    assert sql.count("INSERT INTO crashdata") == 3
    assert sql.count('ON CONFLICT ("ColliRptNum") DO NOTHING') == 3

    # All 7 ColliRptNums must still appear
    for crn in ("3838031", "3887523", "3889408", "3898784", "3908245", "3919354", "3922496"):
        assert f"'{crn}'" in sql


def test_generate_sql_single_batch():
    """All records land in one INSERT when batch_size exceeds record count."""
    records = _load_sample_records()  # 7 records
    sql = generate_sql(records, mode="Pedestrian", batch_size=500)

    assert sql.count("INSERT INTO crashdata") == 1
    assert sql.count('ON CONFLICT ("ColliRptNum") DO NOTHING') == 1


def test_generate_sql_duplicate_do_nothing():
    """Duplicate ColliRptNum rows are passed through unchanged; conflict is DO NOTHING not DO UPDATE."""
    rec = {
        "ColliRptNum": "DUP001",
        "Jurisdiction": "City Street",
        "RegionName": "Northwest",
        "CountyName": "King",
        "CityName": "Seattle",
        "FullDate": "2025-03-01T00:00:00",
        "FullTime": "9:00 AM",
        "MostSevereInjuryType": "No Injury",
        "AgeGroup": "Adult",
        "InvolvedPersons": 1,
        "Latitude": 47.0,
        "Longitude": -122.0,
    }
    sql = generate_sql([rec, rec], mode="Pedestrian")

    # Both rows are emitted — deduplication is handled by the DB, not by generate_sql
    assert sql.count("'DUP001'") == 2

    # Conflict resolution must be DO NOTHING — never DO UPDATE
    assert 'ON CONFLICT ("ColliRptNum") DO NOTHING' in sql
    assert "DO UPDATE" not in sql


# ---------------------------------------------------------------------------
# Entry point for direct execution
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    tests = [
        test_json_fixer,
        test_generate_sql_basic_mapping,
        test_generate_sql_null_coercion_region_placeholder,
        test_generate_sql_null_coercion_age_group_empty,
        test_generate_sql_string_escaping,
        test_generate_sql_batch_splitting,
        test_generate_sql_single_batch,
        test_generate_sql_duplicate_do_nothing,
    ]

    passed = 0
    failed = 0
    for test_fn in tests:
        try:
            test_fn()
            print(f"PASS  {test_fn.__name__}")
            passed += 1
        except AssertionError as e:
            print(f"FAIL  {test_fn.__name__}: {e}")
            failed += 1
        except Exception as e:
            print(f"ERROR {test_fn.__name__}: {e}")
            failed += 1

    print(f"\n{passed} passed, {failed} failed")
