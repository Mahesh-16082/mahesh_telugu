import cloudinary
import cloudinary.uploader

from fastapi import HTTPException, UploadFile, status

from app.cors.config import settings


cloudinary.config(
    cloud_name=settings.cloudinary_cloud_name,
    api_key=settings.cloudinary_api_key,
    api_secret=settings.cloudinary_api_secret,
    secure=True,
)

ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB


async def upload_post_image(image: UploadFile) -> dict[str, str]:
    """Validate and upload one post image to Cloudinary."""
    try:
        if image.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Only JPEG, PNG, and WebP images are allowed.",
            )

        content = await image.read()
        if not content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The uploaded image is empty.",
            )

        if len(content) > MAX_IMAGE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail="Image size must not exceed 5 MB.",
            )

        # Verify the actual file signature rather than trusting Content-Type.
        valid_signatures = (
            content.startswith(b"\xff\xd8\xff"),  # JPEG
            content.startswith(b"\x89PNG\r\n\x1a\n"),  # PNG
            len(content) >= 12
            and content[:4] == b"RIFF"
            and content[8:12] == b"WEBP",  # WebP
        )
        if not any(valid_signatures):
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="The uploaded file is not a valid JPEG, PNG, or WebP image.",
            )

        try:
            result = cloudinary.uploader.upload(
                content,
                folder="telugu_front/posts",
                resource_type="image",
            )
            return {
                "image_url": result["secure_url"],
                "public_id": result["public_id"],
            }
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Image upload failed. Please try again.",
            ) from exc
    finally:
        await image.close()


def delete_post_image(public_id: str) -> None:
    """Delete an image from Cloudinary by its public ID."""
    result = cloudinary.uploader.destroy(
        public_id,
        resource_type="image",
        invalidate=True,
    )
    if result.get("result") not in {"ok", "not found"}:
        raise RuntimeError("Cloudinary could not delete the image.")
