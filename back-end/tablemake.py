import sqlite3


database = 'inv.db'
create_table = 'CREATE TABLE Inventory ( SKU varchar(12), Description varchar(25), Item_Quantity int, Return_Quantity int);'
    
    
try:
    with sqlite3.connect(database) as conn:
        cursor = conn.cursor()
        cursor.execute(create_table)
        conn.commit()
        
except:
    print("Something's awry")