"""extend_posts_table

Revision ID: 5f2e13b51a1d
Revises: c89a695c4fef
Create Date: 2026-10-23 13:02:15.288531

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5f2e13b51a1d'
down_revision: Union[str, Sequence[str], None] = 'c89a695c4fef'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('posts', sa.Column('summary', sa.String(length=500), nullable=True))
    op.add_column('posts', sa.Column('featured_image', sa.String(length=2048), nullable=True))
    op.add_column('posts', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('posts', sa.Column('is_featured', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.add_column('posts', sa.Column('is_breaking_news', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.add_column('posts', sa.Column('seo_title', sa.String(length=255), nullable=True))
    op.add_column('posts', sa.Column('seo_description', sa.String(length=500), nullable=True))
    op.add_column('posts', sa.Column('category_id', sa.Integer(), nullable=True))
    op.add_column('posts', sa.Column('scheduled_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index(op.f('ix_posts_category_id'), 'posts', ['category_id'], unique=False)
    op.create_index(op.f('ix_posts_created_at'), 'posts', ['created_at'], unique=False)
    op.create_index(op.f('ix_posts_is_breaking_news'), 'posts', ['is_breaking_news'], unique=False)
    op.create_index(op.f('ix_posts_is_featured'), 'posts', ['is_featured'], unique=False)
    op.create_index(op.f('ix_posts_published_at'), 'posts', ['published_at'], unique=False)
    op.create_index(op.f('ix_posts_scheduled_at'), 'posts', ['scheduled_at'], unique=False)
    op.create_foreign_key(
        'fk_posts_category_id_categories',
        'posts',
        'categories',
        ['category_id'],
        ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_posts_category_id_categories', 'posts', type_='foreignkey')
    op.drop_index(op.f('ix_posts_scheduled_at'), table_name='posts')
    op.drop_index(op.f('ix_posts_published_at'), table_name='posts')
    op.drop_index(op.f('ix_posts_is_featured'), table_name='posts')
    op.drop_index(op.f('ix_posts_is_breaking_news'), table_name='posts')
    op.drop_index(op.f('ix_posts_created_at'), table_name='posts')
    op.drop_index(op.f('ix_posts_category_id'), table_name='posts')
    op.drop_column('posts', 'scheduled_at')
    op.drop_column('posts', 'category_id')
    op.drop_column('posts', 'seo_description')
    op.drop_column('posts', 'seo_title')
    op.drop_column('posts', 'is_breaking_news')
    op.drop_column('posts', 'is_featured')
    op.drop_column('posts', 'deleted_at')
    op.drop_column('posts', 'featured_image')
    op.drop_column('posts', 'summary')
