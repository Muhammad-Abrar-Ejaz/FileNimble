import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    environment: str = os.getenv("APP_ENV", "development")
    database: str = os.getenv("DATABASE_URL", "")
    redis: str = os.getenv("REDIS_URL", "")
    secret: str = os.getenv("JOB_TOKEN_SECRET", "")
    internal_secret: str = os.getenv("CONVERSION_API_SECRET", "")
    runner_secret: str = os.getenv("RUNNER_SECRET", "")
    runner_url: str = os.getenv("RUNNER_URL", "http://supervisor:8001")
    s3_endpoint: str = os.getenv("S3_ENDPOINT", "http://storage:3900")
    s3_public: str = os.getenv("S3_PUBLIC_ENDPOINT", "http://localhost:3900")
    bucket: str = os.getenv("S3_BUCKET", "filenimble")
    region: str = os.getenv("S3_REGION", "garage")
    fixture: bool = os.getenv("ENABLE_TEST_CAPABILITY", "0") == "1"
    native_test: bool = os.getenv("ENABLE_NATIVE_QUALIFICATION", "0") == "1"
    retention: int = int(os.getenv("FILE_RETENTION_SECONDS", "3600"))
    signed_ttl: int = int(os.getenv("SIGNED_URL_TTL_SECONDS", "300"))
    session_ttl: int = 86400
    max_bytes: int = 1024 * 1024
    max_jobs: int = 3
    max_attempts: int = 3
    lease_seconds: int = 20

    def validate(self):
        if any(
            len(value) < 32 for value in (self.secret, self.internal_secret, self.runner_secret)
        ):
            raise RuntimeError("Generate local secrets with scripts/setup-backend.mjs first.")
        if self.environment not in {"development", "test", "production"}:
            raise RuntimeError("Unknown application environment")
        if self.fixture and self.environment != "test":
            raise RuntimeError("The fixture capability is restricted to the test environment.")
        if self.native_test and self.environment != "test":
            raise RuntimeError("Unqualified native engines are restricted to tests.")
        if not 1 <= self.signed_ttl <= 900 or not 60 <= self.retention <= 3600:
            raise RuntimeError("Unsafe expiry configuration")


settings = Settings()
