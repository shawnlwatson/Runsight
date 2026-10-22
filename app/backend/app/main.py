from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import client
from app.routers import insights, runs

app = FastAPI()

# Add middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET"],
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