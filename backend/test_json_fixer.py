#!/usr/bin/env python3

from app import fix_malformed_json
import json


def test_json_fixer():
    """Test the JSON fixer function with various malformed JSON examples"""

    print("🧪 Testing JSON Fixer Function\n")

    # Test 1: Double-encoded JSON (like the seattle.json case)
    double_encoded = '"[{\\"ColliRptNum\\": \\"3838031\\", \\"Jurisdiction\\": \\"City Street\\", \\"CityName\\": \\"Seattle\\"}]"'
    print("Test 1: Double-encoded JSON")
    print("Input:", double_encoded)
    try:
        result = fix_malformed_json(double_encoded)
        print("✅ Output:")
        print(result)
        print()
    except Exception as e:
        print(f"❌ Error: {e}\n")

    # Test 2: Simple malformed JSON with extra escaping
    malformed_simple = '{"name": "John", "city": "Seattle"}'
    print("Test 2: Simple JSON (should work as-is)")
    print("Input:", malformed_simple)
    try:
        result = fix_malformed_json(malformed_simple)
        print("✅ Output:")
        print(result)
        print()
    except Exception as e:
        print(f"❌ Error: {e}\n")

    # Test 3: JSON string that's been stringified
    stringified_json = '"{\\"name\\": \\"Alice\\", \\"age\\": 30}"'
    print("Test 3: Stringified JSON")
    print("Input:", stringified_json)
    try:
        result = fix_malformed_json(stringified_json)
        print("✅ Output:")
        print(result)
        print()
    except Exception as e:
        print(f"❌ Error: {e}\n")

    print("🎉 Testing complete!")


if __name__ == "__main__":
    test_json_fixer()
