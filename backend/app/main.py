
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.cors.config import settings

app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "message": "Welcome to Telugu Front API",
        "status": "running",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}
