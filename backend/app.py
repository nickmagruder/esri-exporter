try:
    from flask import Flask, jsonify, request
    from flask_cors import CORS

    FLASK_AVAILABLE = True
except ImportError:
    FLASK_AVAILABLE = False
    print("Flask not available. Install with: pip install flask flask-cors")

import json

# declare a new string named seattle with the value of seattle.txt
with open("seattle.txt", "r") as f:
    seattle = f.read()

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
        app.run(debug=True)
    else:
        # Standalone usage example if Flask is not available
        print("🔧 JSON Fixer - Standalone Mode")
        print("Flask not installed. Running standalone example...\n")

        # Example usage
        malformed = '"[{\\"ColliRptNum\\": \\"3838031\\", \\"Jurisdiction\\": \\"City Street\\"}]"'
        print("Input (malformed JSON):")
        print(malformed)
        print("\nOutput (fixed JSON):")
        print(fix_malformed_json(malformed))
