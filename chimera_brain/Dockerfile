FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN bash generate_proto.sh 2>/dev/null || true
EXPOSE 8080 50051
CMD ["python", "server.py"]
