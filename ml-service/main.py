"""Solvix ML service for sentence embeddings and misconception clustering."""

from functools import lru_cache

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="Solvix ML Service", version="0.1.0")
EMBEDDING_DIMENSIONS = 384
MAX_BATCH_SIZE = 32


class EmbeddingRequest(BaseModel):
    texts: list[str]


class EmbeddingResponse(BaseModel):
    dimensions: int
    embeddings: list[list[float]]


class ClusterDoubt(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    text: str = Field(min_length=1, max_length=4_000)


class ClusterRequest(BaseModel):
    doubts: list[ClusterDoubt]
    min_cluster_size: int = Field(default=3, ge=2, le=20)


class ClusterAssignment(BaseModel):
    doubt_id: str
    cluster_id: int | None


class ClusterInfo(BaseModel):
    cluster_id: int
    size: int
    exemplar_doubt_ids: list[str]


class ClusterResponse(BaseModel):
    dimensions: int
    assignments: list[ClusterAssignment]
    clusters: list[ClusterInfo]


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
    if not 1 <= len(request.texts) <= MAX_BATCH_SIZE:
        raise HTTPException(status_code=422, detail="Provide between 1 and 32 texts.")
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


def cluster_embeddings(
    doubt_ids: list[str],
    embeddings: list[list[float]],
    min_cluster_size: int = 3,
) -> ClusterResponse:
    """Cluster vectors, mark HDBSCAN noise as null, and choose centroid exemplars."""
    if len(doubt_ids) != len(embeddings):
        raise ValueError("Doubt ids and embeddings must have matching lengths.")
    if any(len(vector) != EMBEDDING_DIMENSIONS for vector in embeddings):
        raise ValueError("All embeddings must have 384 dimensions.")

    # Very small samples do not support a stable UMAP manifold; leave them unclustered.
    if len(doubt_ids) < max(6, min_cluster_size):
        return ClusterResponse(
            dimensions=EMBEDDING_DIMENSIONS,
            assignments=[ClusterAssignment(doubt_id=doubt_id, cluster_id=None) for doubt_id in doubt_ids],
            clusters=[],
        )

    import hdbscan
    import numpy as np
    import umap
    from sklearn.preprocessing import normalize

    vectors = np.asarray(embeddings, dtype=np.float32)
    reduced = umap.UMAP(
        n_components=min(5, len(doubt_ids) - 2),
        n_neighbors=min(15, len(doubt_ids) - 1),
        min_dist=0.0,
        metric="cosine",
        random_state=42,
        transform_seed=42,
    ).fit_transform(vectors)
    labels = hdbscan.HDBSCAN(
        min_cluster_size=min_cluster_size,
        min_samples=2,
        metric="euclidean",
        cluster_selection_method="eom",
    ).fit_predict(reduced)

    clusters: list[ClusterInfo] = []
    for cluster_id in sorted(label for label in set(labels.tolist()) if label >= 0):
        indexes = np.flatnonzero(labels == cluster_id)
        centroid = normalize(vectors[indexes].mean(axis=0, keepdims=True))[0]
        similarities = vectors[indexes] @ centroid
        nearest = indexes[np.argsort(similarities)[::-1][: min(5, len(indexes))]]
        clusters.append(
            ClusterInfo(
                cluster_id=int(cluster_id),
                size=int(len(indexes)),
                exemplar_doubt_ids=[doubt_ids[int(index)] for index in nearest],
            )
        )

    assignments = [
        ClusterAssignment(
            doubt_id=doubt_id,
            cluster_id=int(label) if label >= 0 else None,
        )
        for doubt_id, label in zip(doubt_ids, labels.tolist(), strict=True)
    ]
    return ClusterResponse(
        dimensions=EMBEDDING_DIMENSIONS,
        assignments=assignments,
        clusters=clusters,
    )


@app.post("/cluster", response_model=ClusterResponse)
def cluster(request: ClusterRequest) -> ClusterResponse:
    """Embed anonymized doubt texts, cluster by topic, and return IDs only."""
    if not 1 <= len(request.doubts) <= 1_000:
        raise HTTPException(status_code=422, detail="Provide between 1 and 1,000 doubts.")
    if any(not doubt.text.strip() for doubt in request.doubts):
        raise HTTPException(status_code=422, detail="Doubt text must not be empty.")
    if len({doubt.id for doubt in request.doubts}) != len(request.doubts):
        raise HTTPException(status_code=422, detail="Doubt ids must be unique within a topic run.")
    if len(request.doubts) < max(6, request.min_cluster_size):
        vectors = [[0.0] * EMBEDDING_DIMENSIONS for _ in request.doubts]
    else:
        encoded = _embedding_model().encode(
            [doubt.text for doubt in request.doubts],
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=False,
        )
        if encoded.ndim != 2 or encoded.shape != (len(request.doubts), EMBEDDING_DIMENSIONS):
            raise HTTPException(status_code=500, detail="The embedding model returned an unexpected dimension.")
        vectors = encoded.tolist()
    return cluster_embeddings(
        [doubt.id for doubt in request.doubts],
        vectors,
        request.min_cluster_size,
    )
