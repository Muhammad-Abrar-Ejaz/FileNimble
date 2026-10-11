import os
import ipaddress
from dataclasses import dataclass
from urllib.parse import urlsplit


def require_public_origin(value):
    try:
        url = urlsplit(value)
        host = url.hostname or ""
        if (
            url.scheme != "https"
            or "." not in host
            or url.username
            or url.password
            or url.path not in {"", "/"}
            or url.query
            or url.fragment
            or url.port not in {None, 443}
            or host.endswith((".local", ".internal"))
        ):
            raise ValueError
        try:
            ipaddress.ip_address(host)
        except ValueError:
            pass
        else:
            raise ValueError
    except ValueError:
        raise RuntimeError("Production origins must be fixed public HTTPS DNS origins") from None


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
    transfer_public: str = os.getenv("TRANSFER_PUBLIC_URL", "")
    site_origin: str = os.getenv("SITE_ORIGIN", "http://localhost:3000")
    production_conversions: bool = os.getenv("PRODUCTION_CONVERSIONS_ENABLED", "false") == "true"
    session_ttl: int = 86400
    max_bytes: int = 1024 * 1024
    max_jobs: int = 3
    max_attempts: int = 3
    lease_seconds: int = 20

    def validate(self):
        if any(
            len(value) < 32 for value in (self.secret, self.internal_secret, self.runner_secret)
        ):
            raise RuntimeError(
                "Generate secrets with setup-backend.mjs or setup-oracle.mjs for this environment."
            )
        if self.environment not in {"development", "test", "production"}:
            raise RuntimeError("Unknown application environment")
        if self.fixture and self.environment != "test":
            raise RuntimeError("The fixture capability is restricted to the test environment.")
        if self.native_test and self.environment != "test":
            raise RuntimeError("Unqualified native engines are restricted to tests.")
        if not 1 <= self.signed_ttl <= 900 or not 60 <= self.retention <= 3600:
            raise RuntimeError("Unsafe expiry configuration")
        if self.environment == "production":
            for value in (self.transfer_public, self.site_origin):
                require_public_origin(value)
            if self.s3_endpoint != "http://storage:3900":
                raise RuntimeError("Production storage must remain on the private storage network")


settings = Settings()
