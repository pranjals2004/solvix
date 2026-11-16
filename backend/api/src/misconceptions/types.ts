export type MisconceptionTopic = {
  id: string;
  name: string;
  slug: string;
  subjectId: string;
  subjectName: string;
  subjectSlug: string;
};

export type DoubtClusterInput = {
  id: string;
  text: string;
  name: string | null;
  email: string;
};

export type ClusteredDoubt = { doubtId: string; clusterId: number | null };
export type ClusterGroup = { clusterId: number; size: number; exemplarDoubtIds: string[] };
export type ClusterOutput = { assignments: ClusteredDoubt[]; clusters: ClusterGroup[] };

export type ClusteredTopic = {
  topic: MisconceptionTopic;
  doubts: DoubtClusterInput[];
  clustering: ClusterOutput;
};

export type MisconceptionExemplar = { doubtId: string; text: string };
export type AdminMisconceptionCluster = {
  id: string;
  runId: string;
  clusterCode: string;
  label: string | null;
  size: number;
  subjectId: string;
  subjectName: string;
  topicId: string;
  topicName: string;
  createdAt: Date;
  exemplars: MisconceptionExemplar[];
};

export type MisconceptionHint = {
  clusterId: string;
  label: string;
  topicId: string;
  topicName: string;
};

export type MisconceptionExportRow = {
  subjectName: string;
  topicName: string;
  clusterCode: string;
  label: string;
  clusterSize: number;
  totalDoubts: number;
  shareOfDoubtVolume: number;
  createdAt: Date;
};

export type MisconceptionTopicRunStatus = {
  topicId: string;
  topicName: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  doubtsProcessed: number;
  clustersFound: number;
  error: string | null;
  startedAt: Date;
  completedAt: Date | null;
};

export interface MisconceptionRepository {
  createQueuedRun(runId: string): Promise<void>;
  failQueuedRun(runId: string, message: string): Promise<void>;
  listTopics(): Promise<MisconceptionTopic[]>;
  listDoubts(topicId: string, limit: number): Promise<DoubtClusterInput[]>;
  startTopicRun(runId: string, topic: MisconceptionTopic): Promise<void>;
  completeTopicRun(
    runId: string,
    topic: MisconceptionTopic,
    doubtsProcessed: number,
    clusters: Array<ClusterGroup & { doubtIds: string[] }>,
  ): Promise<void>;
  failTopicRun(runId: string, topic: MisconceptionTopic, message: string): Promise<void>;
  getRunStatus(runId: string): Promise<MisconceptionTopicRunStatus[]>;
  listAdminClusters(topicId?: string): Promise<AdminMisconceptionCluster[]>;
  labelCluster(clusterId: string, label: string): Promise<AdminMisconceptionCluster | null>;
  listStudentHints(userId: string): Promise<MisconceptionHint[]>;
  listLabeledExportRows(): Promise<MisconceptionExportRow[]>;
}

export interface MisconceptionQueue {
  enqueue(runId: string): Promise<void>;
  close(): Promise<void>;
}

export interface ClusteringProvider {
  cluster(doubts: Array<{ id: string; text: string }>): Promise<ClusterOutput>;
}

export interface MisconceptionRunResult {
  runId: string;
  topicsProcessed: number;
  doubtsProcessed: number;
  clustersFound: number;
}
