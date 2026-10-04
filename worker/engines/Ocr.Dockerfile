FROM python:3.12-slim@sha256:2f17fc044b579bab302c2e8054d3a686e2cb9a83de48e70534b94cd8ebbe06a9
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 HOME=/work TMPDIR=/work OMP_THREAD_LIMIT=1
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr=5.5.0-1+b1 tesseract-ocr-eng=1:4.1.0-2 tesseract-ocr-osd=1:4.1.0-2 qpdf=12.2.0-1 fonts-liberation=1:2.1.5-3 && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir pypdf==6.19.0 defusedxml==0.7.1 pypdfium2==5.13.0 pillow==12.3.0
RUN echo '7d4322bd2a7749724879683fc3912cb542f19906c83bcc1a52132556427170b2  /usr/share/tesseract-ocr/5/tessdata/eng.traineddata' | sha256sum -c - && echo '9cf5d576fcc47564f11265841e5ca839001e7e6f38ff7f7aacf46d15a96b00ff  /usr/share/tesseract-ocr/5/tessdata/osd.traineddata' | sha256sum -c -
RUN useradd --uid 10001 --no-create-home converter
WORKDIR /engine
COPY worker/engines /engine
USER 10001:10001
ENTRYPOINT ["python", "/engine/runner.py"]
