FROM python:3.12-slim@sha256:2f17fc044b579bab302c2e8054d3a686e2cb9a83de48e70534b94cd8ebbe06a9
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 HOME=/work TMPDIR=/work
RUN useradd --uid 10001 --no-create-home converter
WORKDIR /engine
COPY worker/phase11_policy.py worker/engines/archives.py worker/engines/phase11_runner.py /engine/
USER 10001:10001
ENTRYPOINT ["python", "/engine/phase11_runner.py"]
