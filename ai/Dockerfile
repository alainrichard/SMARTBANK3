FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
	PYTHONUNBUFFERED=1 \
	PIP_NO_BUILD_ISOLATION=0

WORKDIR /app

# Install minimal build deps to allow binary wheels to install reliably.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends build-essential gcc libpq-dev ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./

# Try to prefer binary wheels and tolerate transient network issues. If full install fails,
# fall back to a minimal safe set so the app can run with fallback models.
RUN pip install --upgrade pip setuptools wheel \
	&& pip --default-timeout=100 install --no-cache-dir --prefer-binary -r requirements.txt || \
	(echo "Full requirements install failed; installing minimal runtime requirements" && \
		pip install --no-cache-dir flask gunicorn python-dotenv requests)

COPY . ./

EXPOSE 8000
CMD ["gunicorn", "-b", "0.0.0.0:8000", "app:app"]
