from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import create_engine, Integer, String
import app

engine = create_engine("sqlite://", echo=True)



app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///project.db"

class Base(DeclarativeBase):
    pass

db = SQLAlchemy(model_class=Base)

db.init_app(app)





class Inventory(db.Model):
    __tablename__ = "inventory"
    sku: Mapped[str] = mapped_column(primary_key=True)
    Description: Mapped[str]
    Item_Quantity: Mapped[int]
    Return_Quantity: Mapped[int]



with app.app_context():
    db.create_all()