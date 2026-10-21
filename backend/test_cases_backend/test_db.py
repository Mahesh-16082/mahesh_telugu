
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.cors.database import engine


def test_database_connection():
    """Verify that the application can connect to PostgreSQL."""
    try:
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1"))
            assert result.scalar_one() == 1
    except SQLAlchemyError as exc:
        raise AssertionError(
            "PostgreSQL database connection failed."
        ) from exc

from sqlalchemy import inspect

from app.cors.database import engine


def test_authentication_tables_exist():
    """Verify that authentication tables exist in PostgreSQL."""
    inspector = inspect(engine)
    tables = inspector.get_table_names()

    assert "users" in tables, "users table does not exist"
    assert "email_login_otps" in tables, "email_login_otps table does not exist"
    assert "alembic_version" in tables, "alembic_version table does not exist"
