FROM python:3.11-slim

# Instant cache bust: Railway sets RAILWAY_GIT_COMMIT_SHA at build; new commit = full rebuild. Local: "local".
ARG RAILWAY_GIT_COMMIT_SHA=local
RUN echo "cachebust rev=$RAILWAY_GIT_COMMIT_SHA"

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN bash generate_proto.sh 2>/dev/null || true
EXPOSE 8080 50051
CMD ["python", "server.py"]
