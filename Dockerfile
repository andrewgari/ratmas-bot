FROM python:3.11-slim

# Create non-root user for security
RUN useradd -u 10001 -m appuser

WORKDIR /app

# Install dependencies as root
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code and set ownership
COPY src/ ./src/
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

CMD ["python", "-m", "src.main"]

