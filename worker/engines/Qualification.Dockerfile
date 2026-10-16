ARG BACKEND_IMAGE=filenimble-backend:phase5
FROM ${BACKEND_IMAGE}
USER root
RUN pip install --no-cache-dir pypdf==6.19.0 defusedxml==0.7.1 python-docx==1.2.0 python-pptx==1.0.2 openpyxl==3.1.5
USER 10001:10001
