import { z } from 'zod';
import { HttpError } from '../http/errors';
import type { ClusteringProvider, ClusterOutput } from './types';

const responseSchema = z.object({
  dimensions: z.literal(384),
  assignments: z.array(z.object({ doubt_id: z.string(), cluster_id: z.number().int().nullable() })),
  clusters: z.array(
    z.object({
      cluster_id: z.number().int(),
      size: z.number().int().positive(),
      exemplar_doubt_ids: z.array(z.string()).min(1).max(5),
    }),
  ),
});

export class MlServiceClusteringClient implements ClusteringProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 120_000,
  ) {}

  async cluster(doubts: Array<{ id: string; text: string }>): Promise<ClusterOutput> {
    if (doubts.length < 1 || doubts.length > 1_000) {
      throw new Error('A topic clustering batch must contain between 1 and 1,000 doubts.');
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl.replace(/\/$/, '')}/cluster`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ doubts, min_cluster_size: 3 }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new HttpError(
          502,
          'CLUSTERING_FAILED',
          'The clustering service could not process this topic.',
        );
      }
      const parsed = responseSchema.safeParse(await response.json());
      if (!parsed.success || parsed.data.assignments.length !== doubts.length) {
        throw new HttpError(
          502,
          'CLUSTERING_FAILED',
          'The clustering service returned an invalid response.',
        );
      }
      const expectedIds = new Set(doubts.map(({ id }) => id));
      const assignedIds = new Set(parsed.data.assignments.map(({ doubt_id }) => doubt_id));
      if (
        assignedIds.size !== expectedIds.size ||
        [...expectedIds].some((id) => !assignedIds.has(id))
      ) {
        throw new HttpError(
          502,
          'CLUSTERING_FAILED',
          'The clustering service returned unknown doubt ids.',
        );
      }
      const assignedPerCluster = new Map<number, Set<string>>();
      for (const assignment of parsed.data.assignments) {
        if (assignment.cluster_id === null) continue;
        const cluster = assignedPerCluster.get(assignment.cluster_id) ?? new Set<string>();
        cluster.add(assignment.doubt_id);
        assignedPerCluster.set(assignment.cluster_id, cluster);
      }
      const clusterIds = new Set(parsed.data.clusters.map(({ cluster_id }) => cluster_id));
      if (
        clusterIds.size !== parsed.data.clusters.length ||
        [...assignedPerCluster.keys()].some((clusterId) => !clusterIds.has(clusterId)) ||
        parsed.data.clusters.some((cluster) => {
          const members = assignedPerCluster.get(cluster.cluster_id);
          return (
            !members ||
            members.size !== cluster.size ||
            cluster.exemplar_doubt_ids.some((id) => !members.has(id))
          );
        })
      ) {
        throw new HttpError(
          502,
          'CLUSTERING_FAILED',
          'The clustering service returned inconsistent cluster membership.',
        );
      }
      return {
        assignments: parsed.data.assignments.map(({ doubt_id, cluster_id }) => ({
          doubtId: doubt_id,
          clusterId: cluster_id,
        })),
        clusters: parsed.data.clusters.map(({ cluster_id, size, exemplar_doubt_ids }) => ({
          clusterId: cluster_id,
          size,
          exemplarDoubtIds: exemplar_doubt_ids,
        })),
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(503, 'ML_SERVICE_UNAVAILABLE', 'The clustering service is unavailable.');
    } finally {
      clearTimeout(timeout);
    }
  }
}
