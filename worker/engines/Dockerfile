FROM python:3.12-slim@sha256:2f17fc044b579bab302c2e8054d3a686e2cb9a83de48e70534b94cd8ebbe06a9 AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 HOME=/work TMPDIR=/work
RUN useradd --uid 10001 --no-create-home converter
WORKDIR /engine

FROM base AS office
RUN apt-get update && apt-get install -y --no-install-recommends libreoffice-writer libreoffice-calc libreoffice-impress fonts-liberation qpdf && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir pypdf==6.19.0 defusedxml==0.7.1
COPY worker/engines /engine
USER 10001:10001
ENTRYPOINT ["python", "/engine/runner.py"]

FROM base AS utility
RUN apt-get update && apt-get install -y --no-install-recommends qpdf && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir pypdf==6.19.0 defusedxml==0.7.1
COPY worker/engines /engine
USER 10001:10001
ENTRYPOINT ["python", "/engine/runner.py"]

FROM base AS html
RUN apt-get update && apt-get install -y --no-install-recommends qpdf libpango-1.0-0 libpangoft2-1.0-0 fonts-liberation && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir pypdf==6.19.0 defusedxml==0.7.1 weasyprint==70.0
COPY worker/engines /engine
USER 10001:10001
ENTRYPOINT ["python", "/engine/runner.py"]

FROM base AS extraction
RUN apt-get update && apt-get install -y --no-install-recommends qpdf && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir pypdf==6.19.0 defusedxml==0.7.1 pdfplumber==0.11.10 pypdfium2==5.13.0 python-pptx==1.0.2 openpyxl==3.1.5 python-docx==1.2.0
COPY worker/engines /engine
USER 10001:10001
ENTRYPOINT ["python", "/engine/runner.py"]
