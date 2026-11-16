import { anonymizeDoubt } from './anonymize';
import type {
  MisconceptionRepository,
  MisconceptionRunResult,
  ClusteringProvider,
  ClusterGroup,
} from './types';

const MAX_DOUBTS_PER_TOPIC = 1_000;

export class MisconceptionClusteringService {
  constructor(
    private readonly repository: MisconceptionRepository,
    private readonly provider: ClusteringProvider,
  ) {}

  async run(runId: string): Promise<MisconceptionRunResult> {
    await this.repository.createQueuedRun(runId);
    const topics = await this.repository.listTopics();
    const result: MisconceptionRunResult = {
      runId,
      topicsProcessed: 0,
      doubtsProcessed: 0,
      clustersFound: 0,
    };

    for (const topic of topics) {
      await this.repository.startTopicRun(runId, topic);
      try {
        const sources = await this.repository.listDoubts(topic.id, MAX_DOUBTS_PER_TOPIC);
        const doubts = sources.flatMap((source) => {
          const text = anonymizeDoubt(source);
          return text ? [{ id: source.id, text }] : [];
        });
        const clustering =
          doubts.length > 0
            ? await this.provider.cluster(doubts)
            : { assignments: [], clusters: [] };
        const groups = toPersistedGroups(clustering.assignments, clustering.clusters);
        await this.repository.completeTopicRun(runId, topic, doubts.length, groups);
        result.topicsProcessed += 1;
        result.doubtsProcessed += doubts.length;
        result.clustersFound += groups.length;
      } catch (error) {
        await this.repository.failTopicRun(runId, topic, safeErrorMessage(error));
        throw error;
      }
    }
    return result;
  }
}

function toPersistedGroups(
  assignments: Array<{ doubtId: string; clusterId: number | null }>,
  clusters: Array<{ clusterId: number; size: number; exemplarDoubtIds: string[] }>,
): Array<ClusterGroup & { doubtIds: string[] }> {
  const assignedIds = new Map<number, string[]>();
  for (const assignment of assignments) {
    if (assignment.clusterId === null) continue;
    const group = assignedIds.get(assignment.clusterId) ?? [];
    group.push(assignment.doubtId);
    assignedIds.set(assignment.clusterId, group);
  }
  return clusters
    .filter((cluster) => (assignedIds.get(cluster.clusterId)?.length ?? 0) > 0)
    .sort((left, right) => left.clusterId - right.clusterId)
    .map((cluster) => {
      const doubtIds = assignedIds.get(cluster.clusterId) ?? [];
      const memberIds = new Set(doubtIds);
      return {
        clusterId: cluster.clusterId,
        size: doubtIds.length,
        doubtIds,
        exemplarDoubtIds: cluster.exemplarDoubtIds.filter((id) => memberIds.has(id)).slice(0, 5),
      };
    });
}

function safeErrorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : 'Clustering run failed').slice(0, 500);
}
