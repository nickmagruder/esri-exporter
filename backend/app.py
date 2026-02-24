try:
    from flask import Flask, jsonify, request
    from flask_cors import CORS

    FLASK_AVAILABLE = True
except ImportError:
    FLASK_AVAILABLE = False
    print("Flask not available. Install with: pip install flask flask-cors")

import json
import os
from datetime import datetime

def fix_malformed_json(malformed_json_string):
    """
    Converts malformed/double-encoded JSON string to properly formatted JSON string.

    This function handles common JSON malformation issues:
    - Double-encoded JSON (JSON stored as a string within JSON)
    - Extra quote wrapping around JSON
    - Excessive escaping of quotes
    - Multiple layers of quote wrapping

    Args:
        malformed_json_string (str): The malformed JSON string with excessive escaping

    Returns:
        str: Properly formatted JSON string with 2-space indentation

    Raises:
        ValueError: If the JSON cannot be parsed or fixed
    """
    try:
        original_string = malformed_json_string.strip()
        
        # Handle multiple layers of quote wrapping
        # Keep removing outer quotes and unescaping until we get valid JSON
        current_string = original_string
        max_iterations = 5  # Prevent infinite loops
        
        for _ in range(max_iterations):
            # Handle case where JSON is wrapped in extra quotes
            if current_string.startswith('"') and current_string.endswith('"'):
                # Remove outer quotes and unescape
                current_string = current_string[1:-1].replace('\\"', '"').replace('\\\\', '\\')
            
            # Try to parse the current string
            try:
                # First parsing attempt
                first_parse = json.loads(current_string)
                
                # If first parse returns a string, parse again (double-encoded)
                if isinstance(first_parse, str):
                    data = json.loads(first_parse)
                else:
                    data = first_parse
                
                # If we get here, parsing succeeded
                break
                    
            except json.JSONDecodeError:
                # If parsing failed and we haven't modified the string, try direct parsing
                if current_string == original_string:
                    # Try direct parsing as last resort
                    data = json.loads(current_string)
                    break
                else:
                    # Continue the loop to try further unwrapping
                    continue
        else:
            # If we exhausted all iterations, try one final direct parse
            data = json.loads(current_string)

        # Return properly formatted JSON string
        return json.dumps(data, indent=2, ensure_ascii=False)

    except json.JSONDecodeError as e:
        raise ValueError(f"Unable to parse JSON: {str(e)}")
    except Exception as e:
        raise ValueError(f"Error processing JSON: {str(e)}")


def generate_sql(records, mode, batch_size=500):
    """
    Generates a SQL INSERT script for importing crash records into CrashMap's crashdata table.

    Args:
        records (list): List of dicts parsed from the WSDOT API response.
        mode (str): The transport mode stamped on every record ('Pedestrian', 'Bicyclist', etc.).
        batch_size (int): Number of rows per INSERT statement (default 500).

    Returns:
        str: A SQL script with batched INSERT ... ON CONFLICT ("ColliRptNum") DO NOTHING statements.
    """

    def sql_str(value):
        """Wrap a value in single quotes, doubling any internal single quotes. Returns NULL for None."""
        if value is None:
            return "NULL"
        return "'" + str(value).replace("'", "''") + "'"

    def sql_num(value):
        """Return a numeric literal, or NULL for None."""
        if value is None:
            return "NULL"
        return str(value)

    def map_region(value):
        """WSDOT uses a bare apostrophe as a placeholder for missing RegionName — coerce to NULL."""
        if value is None or str(value).strip() == "'":
            return "NULL"
        return sql_str(value)

    def map_age_group(value):
        """Empty AgeGroup strings from WSDOT are coerced to NULL."""
        if value is None or str(value).strip() == "":
            return "NULL"
        return sql_str(value)

    def crash_date(full_date):
        """Extract the date portion (YYYY-MM-DD) from a WSDOT ISO 8601 datetime string."""
        if not full_date:
            return "NULL"
        try:
            return sql_str(str(full_date)[:10])
        except Exception:
            return "NULL"

    def row_values(rec):
        lat = sql_num(rec.get("Latitude"))
        lng = sql_num(rec.get("Longitude"))
        geom = f"ST_SetSRID(ST_MakePoint({lng}, {lat}), 4326)"
        return (
            f"  ({sql_str(rec.get('ColliRptNum'))}, "
            f"{sql_str(rec.get('Jurisdiction'))}, "
            f"'Washington', "
            f"{map_region(rec.get('RegionName'))}, "
            f"{sql_str(rec.get('CountyName'))}, "
            f"{sql_str(rec.get('CityName'))}, "
            f"{sql_str(rec.get('FullDate'))}, "
            f"{crash_date(rec.get('FullDate'))}, "
            f"{sql_str(rec.get('FullTime'))}, "
            f"{sql_str(rec.get('MostSevereInjuryType'))}, "
            f"{map_age_group(rec.get('AgeGroup'))}, "
            f"{sql_num(rec.get('InvolvedPersons'))}, "
            f"{lat}, "
            f"{lng}, "
            f"{sql_str(mode)}, "
            f"{geom})"
        )

    columns = (
        '  "ColliRptNum", "Jurisdiction", "StateOrProvinceName", "RegionName",\n'
        '  "CountyName", "CityName", "FullDate", "CrashDate", "FullTime",\n'
        '  "MostSevereInjuryType", "AgeGroup", "InvolvedPersons",\n'
        '  "Latitude", "Longitude", "Mode", "geom"'
    )

    generated_date = datetime.utcnow().strftime("%Y-%m-%d")
    header = (
        f"-- CrashMap Data Import\n"
        f"-- Mode: {mode}\n"
        f"-- Generated: {generated_date}\n"
        f"-- Records: {len(records)}\n\n"
    )

    parts = [header]

    for i in range(0, len(records), batch_size):
        batch = records[i : i + batch_size]
        values = ",\n".join(row_values(rec) for rec in batch)
        stmt = (
            f"INSERT INTO crashdata (\n{columns}\n) VALUES\n"
            f"{values}\n"
            f'ON CONFLICT ("ColliRptNum") DO NOTHING;\n'
        )
        parts.append(stmt)
        if i + batch_size < len(records):
            parts.append("\n")

    return "".join(parts)


if FLASK_AVAILABLE:
    app = Flask(__name__)
    
    # Enable CORS for all routes
    try:
        CORS(app)
    except:
        # If CORS is not available, add basic CORS headers manually
        @app.after_request
        def after_request(response):
            response.headers.add('Access-Control-Allow-Origin', '*')
            response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
            response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
            return response

    @app.route("/api", methods=["GET"])
    def home():
        return jsonify({"message": "Welcome to the Python-React Starter Kit!"})

    @app.route("/api/fix-json", methods=["POST"])
    def fix_json():
        """
        Endpoint to fix malformed JSON.
        
        Expects JSON payload: {"malformed_json": "your_malformed_json_string_here"}
        Returns: {"fixed_json": "properly_formatted_json_string"}
        
        Example usage:
        curl -X POST http://localhost:5000/api/fix-json \
             -H "Content-Type: application/json" \
             -d '{"malformed_json": "\"[{\\\"name\\\": \\\"John\\\"}]\""}'
        """
        try:
            request_data = request.get_json()

            if not request_data or "malformed_json" not in request_data:
                return (
                    jsonify(
                        {"error": "Missing 'malformed_json' field in request body"}
                    ),
                    400,
                )

            malformed_json = request_data["malformed_json"]

            if not isinstance(malformed_json, str):
                return jsonify({"error": "'malformed_json' must be a string"}), 400

            fixed_json = fix_malformed_json(malformed_json)

            return jsonify(
                {"fixed_json": fixed_json, "message": "JSON successfully formatted"}
            )

        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            return jsonify({"error": f"Unexpected error: {str(e)}"}), 500


if __name__ == "__main__":
    if FLASK_AVAILABLE:
        port = int(os.environ.get("PORT", 5000))
        debug = os.environ.get("FLASK_DEBUG", "true").lower() == "true"
        app.run(host="0.0.0.0", port=port, debug=debug)
    else:
        # Standalone usage example if Flask is not available
        print("JSON Fixer - Standalone Mode")
        print("Flask not installed. Running standalone example...\n")

        # Example usage
        malformed = '"[{\\"ColliRptNum\\": \\"3838031\\", \\"Jurisdiction\\": \\"City Street\\"}]"'
        print("Input (malformed JSON):")
        print(malformed)
        print("\nOutput (fixed JSON):")
        print(fix_malformed_json(malformed))
