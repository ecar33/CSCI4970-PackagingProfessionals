import sqlite3

try:
    with sqlite3.connect("inv.db") as conn:
        print(f"Opened SQLite database with version {sqlite3.sqlite_version} successfully.")
    
except:
    print("Nah brother")
