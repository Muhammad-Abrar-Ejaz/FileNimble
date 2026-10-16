"""Private storage initialization; no uploaded content is logged."""

import time

from app import storage
from app.config import settings


def main():
    settings.validate()
    for attempt in range(30):
        try:
            storage.client().head_bucket(Bucket=settings.bucket)
            break
        except Exception:
            if attempt == 29:
                raise RuntimeError("Private development storage did not become ready") from None
            time.sleep(1)
    if settings.environment == "production":
        # Production browsers use the signed transfer gateway, never the S3 API.
        storage.client().delete_bucket_cors(Bucket=settings.bucket)
        return
    storage.client().put_bucket_cors(
        Bucket=settings.bucket,
        CORSConfiguration={
            "CORSRules": [
                {
                    "AllowedOrigins": [origin],
                    "AllowedMethods": ["PUT", "GET", "HEAD"],
                    "AllowedHeaders": ["content-type"],
                    "ExposeHeaders": ["Content-Disposition", "Content-Length", "Content-Type"],
                    "MaxAgeSeconds": 300,
                }
                for origin in ("http://localhost:3000", "http://localhost:3100")
            ]
        },
    )


if __name__ == "__main__":
    main()
