import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import client
from app.routers import insights, runs

app = FastAPI()

# Add middleware
app.add_middleware(
    CORSMiddleware,
    # FRONTEND_ORIGINS is a comma-separated list set on Vercel, e.g. https://runsight.vercel.app
    allow_origins=os.getenv("FRONTEND_ORIGINS", "http://localhost:3000").split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["*"]
)

app.include_router(runs.router)
app.include_router(insights.router)

@app.get("/")
async def main():
    return {"message": "Home"}

@app.get("/healthz")  # "z" is to distinguish internal routes
def get_health():
    result = client.admin.command("ping")
    return {"message": result}