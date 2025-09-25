from flask import Flask, jsonify

app = Flask(__name__)

@app.route("/api", methods=["GET"])
def home():
    return jsonify({"message": "Welcome to the Python-React Starter Kit!"})

if __name__ == "__main__":
    app.run(debug=True)