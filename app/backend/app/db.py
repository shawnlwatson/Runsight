import os
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

# Load .env
ROOT = Path(__file__).resolve().parent.parent.parent.parent
load_dotenv(f"{ROOT}/.env")

# Connect to MongoDB
connection_string = os.getenv("MONGODB_URI")

if not connection_string:
    raise RuntimeError("MONGODB_URI not set. Please add to .env")

client = MongoClient(connection_string)

db = client.runsight
runs_collection = db.runs
health_collection = db.daily_health