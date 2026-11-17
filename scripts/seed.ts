import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import type { PoolClient } from 'pg';
import { ContentService } from '../backend/api/src/content/service';
import { MlServiceEmbeddingClient } from '../backend/api/src/content/embedding-client';
import type { NoteInput, QuestionInput } from '../backend/api/src/content/types';
import { loadConfig } from '../backend/api/src/config/env';
import { createPool } from '../backend/api/src/db/pool';
import { PostgresContentRepository } from '../backend/api/src/db/content-repository';

dotenv.config({ path: resolve(__dirname, '../.env') });

const subjectSeeds = [
  {
    name: 'Data Structures & Algorithms', slug: 'dsa',
    topics: [{ name: 'Data Structures', slug: 'data-structures' }, { name: 'Algorithms', slug: 'algorithms' }],
  },
  {
    name: 'Operating Systems', slug: 'operating-systems',
    topics: [{ name: 'Processes and Threads', slug: 'processes-threads' }, { name: 'Memory Management', slug: 'memory-management' }],
  },
  {
    name: 'Database Management Systems', slug: 'dbms',
    topics: [{ name: 'Relational Model', slug: 'relational-model' }, { name: 'Transactions', slug: 'transactions' }],
  },
  {
    name: 'Computer Networks', slug: 'computer-networks',
    topics: [{ name: 'Network Layers', slug: 'network-layers' }, { name: 'Transport Protocols', slug: 'transport-protocols' }],
  },
  {
    name: 'Theory of Computation', slug: 'theory-of-computation',
    topics: [{ name: 'Finite Automata', slug: 'finite-automata' }, { name: 'Context-Free Grammars', slug: 'context-free-grammars' }],
  },
];

const demoNoteSeeds = [
  {
    subjectSlug: 'dsa', topicSlug: 'data-structures', title: 'Data structures overview',
    content: 'An abstract data type describes the values and operations available to a user; a data structure is a concrete way to implement them. Arrays provide constant-time indexed access, while inserting or deleting near the beginning usually requires shifting elements. Linked lists make local insertion inexpensive when a node reference is already known, but finding a position requires traversal. Stacks follow last-in, first-out order; queues follow first-in, first-out order. Choose a representation by considering the operations and costs that matter to the problem.',
  },
  {
    subjectSlug: 'dsa', topicSlug: 'algorithms', title: 'Algorithm analysis overview',
    content: 'Asymptotic analysis describes how an algorithm’s resource use grows with input size, ignoring constant factors and lower-order terms. Big O is an asymptotic upper bound, Big Omega is a lower bound, and Big Theta is a tight bound when both apply. When analyzing a loop, count how often its body runs; for nested loops, account for their combined iterations. For recursive algorithms, write a recurrence that reflects the work per level and the number and size of recursive calls. State the assumptions used, such as worst-case or average-case input.',
  },
  {
    subjectSlug: 'operating-systems', topicSlug: 'processes-threads', title: 'Processes, threads, and scheduling',
    content: 'A process is a running program with its own address space and operating-system resources. Threads within a process have separate execution state, including stacks and registers, while sharing the process address space and many resources. Shared mutable data therefore needs synchronization when threads access it concurrently. A context switch saves one execution context and restores another; it enables sharing a processor but adds overhead. A scheduler chooses runnable work according to the operating system’s policy, balancing goals such as responsiveness, fairness, and throughput.',
  },
  {
    subjectSlug: 'operating-systems', topicSlug: 'memory-management', title: 'Virtual memory and paging',
    content: 'Virtual memory gives each process an address space that the operating system and hardware translate to physical memory. In a paged system, virtual pages map to physical frames through page tables; a translation lookaside buffer caches recent translations. If a referenced page is not resident, a page fault lets the operating system load it or report an invalid access. Paging simplifies allocation but page tables and translation still have costs. If memory is overcommitted, frequent page replacement can reduce useful execution time.',
  },
  {
    subjectSlug: 'dbms', topicSlug: 'relational-model', title: 'Relations, keys, and constraints',
    content: 'In the relational model, a relation is represented as a set of tuples over named attributes. A candidate key uniquely identifies a tuple and is minimal; one candidate key is selected as the primary key. A foreign key expresses a reference to a key in another relation and can enforce referential integrity. Integrity constraints describe valid database states. Functional dependencies express when values of one attribute set determine another and help reason about redundancy and normalization. SQL tables may allow duplicate rows unless constraints prevent them, so practical SQL behavior is not identical to the pure relational model.',
  },
  {
    subjectSlug: 'dbms', topicSlug: 'transactions', title: 'Transactions and ACID',
    content: 'A transaction groups database operations into a unit with a defined commit or rollback outcome. Atomicity means the unit is all-or-nothing; consistency means committed work preserves declared invariants; isolation controls the effects of concurrent transactions; durability means committed changes survive failures according to the system’s guarantees. Concurrency control may use locks or multiversion techniques. Isolation levels make different tradeoffs, so reason about the specific anomalies a level permits instead of assuming every transaction behaves as if it ran alone.',
  },
  {
    subjectSlug: 'computer-networks', topicSlug: 'network-layers', title: 'Network layers and encapsulation',
    content: 'Layered network designs divide communication into responsibilities and define interfaces between them. As data moves down a sender’s protocol stack, each layer can add control information in a header; the receiver processes the corresponding headers as data moves upward. Link protocols deliver frames over a local link, the Internet Protocol forwards packets between networks, and transport protocols provide process-to-process communication. Layer models are useful reasoning tools, but real protocol suites do not always map one-to-one onto a textbook model.',
  },
  {
    subjectSlug: 'computer-networks', topicSlug: 'transport-protocols', title: 'TCP, UDP, and ports',
    content: 'Transport protocols carry data between application processes, with port numbers helping identify endpoints on a host. TCP provides a reliable, ordered byte stream using connection setup, acknowledgements, retransmission, and flow and congestion control. UDP provides datagrams without TCP’s built-in reliability or ordering guarantees, allowing applications to choose their own mechanisms when needed. A port identifies a transport endpoint; it is not by itself a complete network address. Choose the protocol based on the application’s delivery and latency requirements.',
  },
  {
    subjectSlug: 'theory-of-computation', topicSlug: 'finite-automata', title: 'Finite automata and regular languages',
    content: 'A deterministic finite automaton has a finite state set, an input alphabet, a transition function, a start state, and accepting states. It accepts a string when the transitions from the start state end in an accepting state after all input is consumed. A nondeterministic finite automaton may have several possible transitions; it accepts if at least one path accepts. NFAs and DFAs recognize the same class of languages, the regular languages, though converting an NFA to a DFA can increase the number of states. Regular languages are closed under operations including union, concatenation, and Kleene star.',
  },
  {
    subjectSlug: 'theory-of-computation', topicSlug: 'context-free-grammars', title: 'Context-free grammars and derivations',
    content: 'A context-free grammar consists of variables, terminals, a start variable, and production rules whose left side is one variable. A derivation repeatedly replaces a variable using a production; its result is a terminal string in the grammar’s language. A parse tree records the structure of a derivation. A grammar is ambiguous if some string has more than one parse tree, although a language may have another unambiguous grammar. Context-free grammars describe nested structures that finite automata cannot in general recognize, such as balanced parentheses.',
  },
].map((note) => ({
  ...note,
  title: `[DEMO] ${note.title}`,
  content: `DEMO STUDY MATERIAL — review and replace with instructor-approved content before relying on it.\n\n${note.content}`,
}));

async function seed() {
  const config = loadConfig();
  const pool = createPool(config.databaseUrl);
  const client = await pool.connect();
  try {
    const topicIds = await ensureSubjectsAndTopics(client);
    const questions: Array<{ id: string; input: QuestionInput }> = [];
    const notes: Array<{ id: string; input: NoteInput }> = [];
    for (const subject of subjectSeeds) {
      for (let index = 1; index <= 10; index += 1) {
        const topic = subject.topics[(index - 1) % subject.topics.length]!;
        const topicId = topicIds.get(`${subject.slug}/${topic.slug}`);
        if (!topicId) throw new Error(`Seed topic was not created: ${subject.slug}/${topic.slug}`);
        const reference = `${subject.slug}-placeholder-${String(index).padStart(2, '0')}`;
        questions.push({
          id: deterministicUuid(reference),
          input: {
            subjectId: topicIds.get(`${subject.slug}/__subject__`)!,
            topicId,
            type: 'mcq',
            statementLatex: `[SYNTHETIC PLACEHOLDER ${reference}] Replace this text with reviewed, licensed ${subject.name} question content before release. This record exists only to exercise content browsing and import flows.`,
            optionsJson: ['Placeholder option A', 'Placeholder option B', 'Placeholder option C', 'Placeholder option D'],
            correctAnswerJson: { selected: 'A', syntheticPlaceholder: true },
            natTolerance: null,
            solutionLatex: `SYNTHETIC PLACEHOLDER SOLUTION for ${reference}. Replace with an author-reviewed worked solution before release.`,
            isPyq: false,
            pyqYear: null,
            difficultyRating: 1000,
          },
        });
      }
    }

    for (const note of demoNoteSeeds) {
      const topicId = topicIds.get(`${note.subjectSlug}/${note.topicSlug}`);
      const subjectId = topicIds.get(`${note.subjectSlug}/__subject__`);
      if (!topicId || !subjectId) {
        throw new Error(`Seed note topic was not created: ${note.subjectSlug}/${note.topicSlug}`);
      }
      const reference = `demo-note-${note.subjectSlug}-${note.topicSlug}`;
      notes.push({
        id: deterministicUuid(reference),
        input: {
          subjectId,
          topicId,
          title: note.title,
          content: note.content,
        },
      });
    }

    const repository = new PostgresContentRepository(pool);
    const content = new ContentService(repository, new MlServiceEmbeddingClient(config.mlServiceUrl));
    const result = await content.importContent(questions, notes);
    process.stdout.write(
      `Seeded ${result.questions} clearly labelled synthetic placeholder questions and ${result.notes} clearly labelled demo study notes.\n`,
    );
  } finally {
    client.release();
    await pool.end();
  }
}

async function ensureSubjectsAndTopics(client: PoolClient): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  await client.query('BEGIN');
  try {
    for (const subject of subjectSeeds) {
      const result = await client.query<{ id: string }>(
        `INSERT INTO subjects (name, slug) VALUES ($1, $2)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [subject.name, subject.slug],
      );
      const subjectId = result.rows[0]!.id;
      ids.set(`${subject.slug}/__subject__`, subjectId);
      for (const topic of subject.topics) {
        const topicResult = await client.query<{ id: string }>(
          `INSERT INTO topics (subject_id, name, slug) VALUES ($1, $2, $3)
           ON CONFLICT (subject_id, slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
          [subjectId, topic.name, topic.slug],
        );
        ids.set(`${subject.slug}/${topic.slug}`, topicResult.rows[0]!.id);
      }
    }
    await client.query('COMMIT');
    return ids;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

function deterministicUuid(value: string): string {
  const namespace = Buffer.from('6ba7b8119dad11d180b400c04fd430c8', 'hex');
  const bytes = createHash('sha1').update(namespace).update(value).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

void seed().catch((error: unknown) => {
  process.stderr.write(`Seed failed: ${String(error)}\n`);
  process.exitCode = 1;
});
