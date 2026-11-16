"""Solvix ML service entrypoint; embedding and clustering arrive in later phases."""

from fastapi import FastAPI

app = FastAPI(title="Solvix ML Service", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    """Return process liveness without loading the sentence-transformer model."""
    return {"status": "ok"}
