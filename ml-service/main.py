"""Solvix ML service for sentence embeddings and later misconception clustering."""

from functools import lru_cache

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="Solvix ML Service", version="0.1.0")
EMBEDDING_DIMENSIONS = 384
MAX_BATCH_SIZE = 32


class EmbeddingRequest(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=MAX_BATCH_SIZE)


class EmbeddingResponse(BaseModel):
    dimensions: int
    embeddings: list[list[float]]


@lru_cache(maxsize=1)
def _embedding_model():
    """Load the fixed MiniLM model only when the first embedding is requested."""
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")


@app.get("/health")
def health() -> dict[str, str]:
    """Return process liveness without downloading the sentence-transformer model."""
    return {"status": "ok"}


@app.post("/embed", response_model=EmbeddingResponse)
def embed(request: EmbeddingRequest) -> EmbeddingResponse:
    """Return normalized 384-dimensional embeddings for a small text batch."""
    if any(not text.strip() or len(text) > 20_000 for text in request.texts):
        raise HTTPException(status_code=422, detail="Texts must be non-empty and at most 20,000 characters.")

    vectors = _embedding_model().encode(
        request.texts,
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=False,
    )
    if vectors.ndim != 2 or vectors.shape != (len(request.texts), EMBEDDING_DIMENSIONS):
        raise HTTPException(status_code=500, detail="The embedding model returned an unexpected dimension.")
    return EmbeddingResponse(
        dimensions=EMBEDDING_DIMENSIONS,
        embeddings=vectors.tolist(),
    )
