
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from app.deps import get_current_user, require_master_admin
from app.cors.config import settings
from app.cors.database import SessionLocal
from app.models.user import User
from app.routers.auth import router as auth_router
from app.routers.posts import router as posts_router
from app.routers.categories import router as categories_router
from app.routers.breaking_news import router as breaking_news_router

def bootstrap_admin() -> None:
    """Create the configured master admin if the account doesn't exist."""
    admin_email = settings.admin_email.strip().lower()

    with SessionLocal() as db:
        existing_admin = db.scalar(
            select(User).where(User.email == admin_email)
        )

        if existing_admin is None:
            admin = User(
                first_name="Master",
                last_name="Admin",
                display_name="Master Admin",
                email=admin_email,
                role="MASTER_ADMIN",
                is_active=True,
            )
            db.add(admin)
            db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    bootstrap_admin()
    yield


app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    version="1.0.0",
    lifespan=lifespan,
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
app.include_router(auth_router)
app.include_router(posts_router)
app.include_router(categories_router)
app.include_router(breaking_news_router)

@app.get("/")
def root():
    return {
        "message": "Welcome to Telugu Front API",
        "status": "running",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.get("/api/auth/me")
def read_current_user(
    current_user: User = Depends(get_current_user),
):
    return {
        "email": current_user.email,
        "display_name": current_user.display_name,
        "role": current_user.role,
    }


@app.get("/api/admin/test")
def admin_test(
    current_user: User = Depends(require_master_admin),
):
    return {
        "message": "Master admin access granted.",
        "role": current_user.role,
    }
