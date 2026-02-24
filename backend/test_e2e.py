#!/usr/bin/env python3
"""End-to-end integration tests: live WSDOT API calls for both modes.

These tests make real HTTP requests to the WSDOT collision API and validate
the full pipeline: API fetch → fix_malformed_json → generate_sql.

Run all e2e tests:
    pytest test_e2e.py -v

Run directly:
    python test_e2e.py
"""

import json
import requests
from app import fix_malformed_json, generate_sql

# Narrow date window (one month) keeps response size small (~50–200 records/mode).
START_DATE = "20250101"
END_DATE   = "20250131"

_WSDOT_BASE_URL = (
    "https://remoteapps.wsdot.wa.gov/highwaysafety/collision/data/portal/public/"
    "CrashDataPortalService.svc/REST/GetPublicPortalData"
)
_WSDOT_PARAMS_BASE = {
    "rptCategory": "Pedestrians and Pedacyclists",
    "locationType": "",
    "locationName": "",
    "jurisdiction": "",
    "reportStartDate": START_DATE,
    "reportEndDate":   END_DATE,
}
_WSDOT_RPT_NAME = {
    "Pedestrian": "Pedestrians by Injury Type",
    "Bicyclist":  "Bicyclists by Injury Type",
}

# Keys every WSDOT record is expected to contain.
EXPECTED_KEYS = {
    "ColliRptNum", "Jurisdiction", "RegionName", "CountyName",
    "CityName", "FullDate", "FullTime", "MostSevereInjuryType",
    "AgeGroup", "InvolvedPersons", "Latitude", "Longitude",
}


def _fetch_records(mode):
    """Fetch WSDOT data for *mode* and return the parsed list of record dicts."""
    params = {**_WSDOT_PARAMS_BASE, "rptName": _WSDOT_RPT_NAME[mode]}
    resp = requests.get(_WSDOT_BASE_URL, params=params, timeout=60)
    resp.raise_for_status()
    fixed = fix_malformed_json(resp.text)
    return json.loads(fixed)


# ---------------------------------------------------------------------------
# Reachability
# ---------------------------------------------------------------------------

def test_e2e_pedestrian_api_reachable():
    """Pedestrian WSDOT endpoint returns HTTP 200 with a non-empty body."""
    params = {**_WSDOT_PARAMS_BASE, "rptName": _WSDOT_RPT_NAME["Pedestrian"]}
    resp = requests.get(_WSDOT_BASE_URL, params=params, timeout=60)
    assert resp.status_code == 200, f"Unexpected status: {resp.status_code}"
    assert len(resp.text) > 0, "Response body is empty"


def test_e2e_bicyclist_api_reachable():
    """Bicyclist WSDOT endpoint returns HTTP 200 with a non-empty body."""
    params = {**_WSDOT_PARAMS_BASE, "rptName": _WSDOT_RPT_NAME["Bicyclist"]}
    resp = requests.get(_WSDOT_BASE_URL, params=params, timeout=60)
    assert resp.status_code == 200, f"Unexpected status: {resp.status_code}"
    assert len(resp.text) > 0, "Response body is empty"


# ---------------------------------------------------------------------------
# Parse / field validation
# ---------------------------------------------------------------------------

def test_e2e_pedestrian_parse():
    """Pedestrian response parses to a non-empty list of dicts with all expected keys."""
    records = _fetch_records("Pedestrian")
    assert isinstance(records, list), "Parsed data is not a list"
    assert len(records) > 0, "No records returned for Pedestrian / Jan 2025"
    for key in EXPECTED_KEYS:
        assert key in records[0], f"First record missing key: {key}"


def test_e2e_bicyclist_parse():
    """Bicyclist response parses to a non-empty list of dicts with all expected keys."""
    records = _fetch_records("Bicyclist")
    assert isinstance(records, list), "Parsed data is not a list"
    assert len(records) > 0, "No records returned for Bicyclist / Jan 2025"
    for key in EXPECTED_KEYS:
        assert key in records[0], f"First record missing key: {key}"


# ---------------------------------------------------------------------------
# Full pipeline: API → parse → generate_sql
# ---------------------------------------------------------------------------

def _assert_sql_structure(sql, mode, record_count):
    """Shared structural assertions for generated SQL."""
    assert f"-- Mode: {mode}" in sql
    assert f"-- Records: {record_count}" in sql
    assert "INSERT INTO crashdata" in sql

    # Required columns (double-quoted PascalCase)
    for col in ('"ColliRptNum"', '"Jurisdiction"', '"StateOrProvinceName"',
                '"RegionName"', '"CountyName"', '"CityName"', '"FullDate"',
                '"CrashDate"', '"FullTime"', '"MostSevereInjuryType"',
                '"AgeGroup"', '"InvolvedPersons"', '"Latitude"', '"Longitude"',
                '"Mode"', '"geom"'):
        assert col in sql, f"Column missing from INSERT: {col}"

    # Hardcoded fields
    assert "'Washington'" in sql          # StateOrProvinceName
    assert f"'{mode}'" in sql            # Mode stamped from UI selection
    assert "ST_SetSRID(ST_MakePoint(" in sql  # PostGIS geometry

    # Conflict clause
    assert 'ON CONFLICT ("ColliRptNum") DO NOTHING' in sql
    assert "DO UPDATE" not in sql

    # Dropped columns must never appear
    assert "CrashStatePlaneX" not in sql
    assert "CrashStatePlaneY" not in sql


def test_e2e_pedestrian_generate_sql():
    """Pedestrian pipeline: API → parse → generate_sql produces structurally valid SQL."""
    records = _fetch_records("Pedestrian")
    sql = generate_sql(records, mode="Pedestrian")
    _assert_sql_structure(sql, "Pedestrian", len(records))


def test_e2e_bicyclist_generate_sql():
    """Bicyclist pipeline: API → parse → generate_sql produces structurally valid SQL."""
    records = _fetch_records("Bicyclist")
    sql = generate_sql(records, mode="Bicyclist")
    _assert_sql_structure(sql, "Bicyclist", len(records))


# ---------------------------------------------------------------------------
# Record integrity
# ---------------------------------------------------------------------------

def test_e2e_pedestrian_all_collirptnums_present():
    """Every ColliRptNum from the Pedestrian API response appears in the SQL output."""
    records = _fetch_records("Pedestrian")
    sql = generate_sql(records, mode="Pedestrian")
    missing = [r["ColliRptNum"] for r in records if f"'{r['ColliRptNum']}'" not in sql]
    assert not missing, f"ColliRptNums missing from SQL: {missing[:5]}"


def test_e2e_bicyclist_all_collirptnums_present():
    """Every ColliRptNum from the Bicyclist API response appears in the SQL output."""
    records = _fetch_records("Bicyclist")
    sql = generate_sql(records, mode="Bicyclist")
    missing = [r["ColliRptNum"] for r in records if f"'{r['ColliRptNum']}'" not in sql]
    assert not missing, f"ColliRptNums missing from SQL: {missing[:5]}"


def test_e2e_pedestrian_crash_date_format():
    """CrashDate values in SQL are YYYY-MM-DD (10-char date slice from FullDate)."""
    records = _fetch_records("Pedestrian")
    sql = generate_sql(records, mode="Pedestrian")
    # Spot-check first record: CrashDate should be the first 10 chars of FullDate
    first = records[0]
    expected_crash_date = str(first["FullDate"])[:10]
    assert f"'{expected_crash_date}'" in sql, (
        f"CrashDate '{expected_crash_date}' not found in SQL"
    )


def test_e2e_bicyclist_crash_date_format():
    """CrashDate values in SQL are YYYY-MM-DD (10-char date slice from FullDate)."""
    records = _fetch_records("Bicyclist")
    sql = generate_sql(records, mode="Bicyclist")
    first = records[0]
    expected_crash_date = str(first["FullDate"])[:10]
    assert f"'{expected_crash_date}'" in sql, (
        f"CrashDate '{expected_crash_date}' not found in SQL"
    )


# ---------------------------------------------------------------------------
# Entry point for direct execution
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    tests = [
        test_e2e_pedestrian_api_reachable,
        test_e2e_bicyclist_api_reachable,
        test_e2e_pedestrian_parse,
        test_e2e_bicyclist_parse,
        test_e2e_pedestrian_generate_sql,
        test_e2e_bicyclist_generate_sql,
        test_e2e_pedestrian_all_collirptnums_present,
        test_e2e_bicyclist_all_collirptnums_present,
        test_e2e_pedestrian_crash_date_format,
        test_e2e_bicyclist_crash_date_format,
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
