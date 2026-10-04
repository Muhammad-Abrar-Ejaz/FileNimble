import hashlib
import os
from uuid import uuid4

import boto3
from botocore.config import Config

from app.config import settings


def client(public=False):
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_public if public else settings.s3_endpoint,
        region_name=settings.region,
        aws_access_key_id=os.environ["S3_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["S3_SECRET_ACCESS_KEY"],
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"},
            connect_timeout=3,
            read_timeout=5,
            retries={"max_attempts": 1},
        ),
    )


def object_key(role):
    return f"{role}/{uuid4().hex}"


def read(key, maximum=None):
    maximum = settings.max_bytes if maximum is None else maximum
    obj = client().get_object(Bucket=settings.bucket, Key=key)
    try:
        if obj["ContentLength"] > maximum:
            raise ValueError("FILE_TOO_LARGE")
        data = obj["Body"].read(maximum + 1)
        if len(data) > maximum:
            raise ValueError("FILE_TOO_LARGE")
        return data
    finally:
        obj["Body"].close()


def write(key, data):
    client().put_object(
        Bucket=settings.bucket, Key=key, Body=data, ContentType="application/octet-stream"
    )
    return hashlib.sha256(data).hexdigest()


def remove(key):
    client().delete_object(Bucket=settings.bucket, Key=key)


def sign_upload(key, ttl, size):
    # Signed Content-Length binds the grant to the declared size. Finalization still verifies bytes.
    return client(True).generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.bucket,
            "Key": key,
            "ContentType": "application/octet-stream",
            "ContentLength": size,
        },
        ExpiresIn=ttl,
    )


def sign_download(key, ttl, filename="fixture-result.bin", media_type="application/octet-stream"):
    return client(True).generate_presigned_url(
        "get_object",
        Params={
            "Bucket": settings.bucket,
            "Key": key,
            "ResponseContentDisposition": f'attachment; filename="{filename}"',
            "ResponseContentType": media_type,
        },
        ExpiresIn=ttl,
    )
