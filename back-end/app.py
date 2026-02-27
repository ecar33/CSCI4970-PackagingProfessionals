from flask import Flask, jsonify
import sqlite3


app = Flask(__name__)


create_table = 'CREATE TABLE Inventory ( 
    SKU varchar(12),
    Description varchar(25),
    Item_Quantity int,
    Return_Quantity int
);'
    


@app.get("/api/health")
def health():
    return jsonify(status="ok")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)