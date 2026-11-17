export type PeerReply = {
  id: string;
  authorName: string;
  body: string;
  createdAt: Date;
};

export type PeerThread = {
  id: string;
  authorName: string;
  isAnonymous: boolean;
  title: string;
  body: string;
  subjectId: string | null;
  subjectName: string | null;
  topicId: string | null;
  topicName: string | null;
  questionId: string | null;
  createdAt: Date;
  replyCount: number;
  replies: PeerReply[];
};

export type CreatePeerThread = {
  title: string;
  body: string;
  subjectId: string | null;
  topicId: string | null;
  questionId: string | null;
  anonymous: boolean;
};

export interface PeerDoubtRepository {
  list(input: { subjectId: string | null; topicId: string | null; limit: number }): Promise<PeerThread[]>;
  get(threadId: string): Promise<PeerThread | null>;
  create(userId: string, input: CreatePeerThread): Promise<PeerThread>;
  reply(threadId: string, userId: string, body: string): Promise<PeerThread | null>;
}
