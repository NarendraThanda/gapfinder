export const SAMPLE_SYLLABUS = `
COURSE: CS301 - Operating Systems and Architecture
INSTRUCTOR: Prof. Elena Vance
ACADEMIC YEAR: 2026-2027

COURSE DESCRIPTION:
This course examines the fundamental principles of operating systems, including process management, CPU scheduling, concurrency, synchronization, memory management, virtual memory paging, file systems, and distributed storage.

MODULE 1: Process Management & CPU Scheduling
- 1.1 Process Lifecycle: States (Ready, Running, Waiting, Terminated), Process Control Blocks (PCB), and context switching overhead.
- 1.2 CPU Scheduling Algorithms: First-Come First-Served (FCFS), Shortest Job Next (SJN), Round Robin (RR) with quantum selection, and Multi-Level Feedback Queues (MLFQ).
- 1.3 Inter-Process Communication (IPC): Shared memory buffers, message passing, Unix pipes, and signals.

MODULE 2: Concurrency & Synchronization
- 2.1 Critical Section Problem: Mutual exclusion, progress, and bounded waiting requirements.
- 2.2 Synchronization Primitives: Mutex locks, Counting & Binary Semaphores, Monitors, and atomic Compare-And-Swap (CAS) instructions.
- 2.3 Classical Concurrency Problems: Producer-Consumer problem, Readers-Writers problem, and Dining Philosophers.
- 2.4 Deadlocks: Necessary conditions (Mutual Exclusion, Hold and Wait, No Preemption, Circular Wait), Resource Allocation Graphs (RAG), Banker's Algorithm, and Deadlock Recovery.

MODULE 3: Memory Management & Virtual Memory
- 3.1 Contiguous Memory Allocation: Fixed vs variable partitioning, external and internal fragmentation, compaction algorithms.
- 3.2 Paging Architecture: Page tables, Translation Lookaside Buffer (TLB) hit ratios and Effective Memory Access Time (EMAT), multi-level hierarchical paging.
- 3.3 Virtual Memory: Demand paging, page fault handling routine, working set model, and thrashing causes.
- 3.4 Page Replacement Algorithms: FIFO, Optimal (Belady's Min), Least Recently Used (LRU), Second-Chance (Clock), and Belady's Anomaly.

MODULE 4: Storage & File Systems
- 4.1 File System Interface: Directory structures (single-level, hierarchical, acyclic graphs), file control blocks, and metadata inodes.
- 4.2 Allocation Methods: Contiguous allocation, linked-list allocation, and indexed allocation (Unix multi-level inodes).
- 4.3 Disk Scheduling: FCFS, SSTF, SCAN (Elevator), C-SCAN, and modern SSD wear-leveling considerations.
`

export const SAMPLE_NOTES = `
CHAPTER EXCERPTS & LECTURE NOTES - OS MEMORY & CONCURRENCY:

SECTION 2.4: THE BANKER'S ALGORITHM AND DEADLOCK PREVENTION
A deadlock occurs when a set of processes are blocked because each process is holding a resource and waiting for another resource held by some other process in the set.
The four Coffman conditions must hold simultaneously for a deadlock to arise:
1. Mutual Exclusion: At least one resource must be held in a non-shareable mode.
2. Hold and Wait: A process must hold at least one resource and wait to acquire additional resources.
3. No Preemption: Resources cannot be preempted forcibly; they are released only voluntarily.
4. Circular Wait: A closed chain of processes exists such that each process holds resources needed by the next.

The Banker's Algorithm, developed by Edsger Dijkstra, tests for safety by simulating the allocation of predetermined maximum possible amounts of all resources, and then makes an 's-state' check to test for possible activities, before deciding whether allocation should be allowed to continue. A state is considered safe if there exists a safe sequence <P1, P2, ..., Pn> such that for each Pi, the resources that Pi can still request can be satisfied by currently available resources plus the resources held by all Pj (where j < i).

SECTION 3.2: TRANSLATION LOOKASIDE BUFFER (TLB) AND PAGING EFFICIENCY
Because page tables are stored in main memory, translating a virtual memory address to a physical memory address requires two memory accesses: one to retrieve the page table entry (PTE), and one to access the actual data or instruction. To overcome this latency bottleneck, modern architectures employ a hardware associative cache termed the Translation Lookaside Buffer (TLB).
When computing Effective Memory Access Time (EMAT):
Given a TLB hit ratio α, a TLB search latency ε, and main memory access time m:
EMAT = (m + ε) * α + (2m + ε) * (1 - α)
For instance, with hit ratio α = 90%, TLB lookup ε = 2ns, and memory access m = 100ns:
EMAT = (100 + 2) * 0.90 + (200 + 2) * 0.10 = 91.8 + 20.2 = 112ns, representing an enormous speedup over 200ns dual access.

SECTION 3.3: DEMAND PAGING, THRASHING AND THE WORKING SET
In demand paging, pages are loaded only when an address reference causes a page fault. When a process doesn't possess sufficient physical frames to accommodate its active locality of reference, the page-fault rate spikes dramatically. The operating system, observing low CPU utilization caused by processes waiting for I/O page swaps, may naively increase the degree of multiprogramming, admitting more processes. This triggers a catastrophic collapse known as 'thrashing', where the system spends more time servicing page faults and swapping than executing productive instructions.
Peter Denning's Working Set Model resolves thrashing by monitoring the set of pages referenced by a process during the most recent working-set window Δ, ensuring a process is only allocated frames if its entire working set fits in memory.
`

export const SAMPLE_QUESTIONS_PAPER = `
PAST MIDTERM EXAM: OPERATING SYSTEMS PRINCIPLES (FALL 2025)

QUESTION 1 [Process Scheduling]:
Explain why the Shortest Remaining Time First (SRTF) algorithm is optimal with respect to minimizing average waiting time, yet suffers from starvation for long compute-bound jobs.

QUESTION 2 [Deadlock Detection]:
Consider 5 processes P0 through P4 and 3 resource types A (10 instances), B (5 instances), C (7 instances).
Demonstrate the step-by-step vector arithmetic of the Banker's Algorithm to locate a safe sequence.

QUESTION 3 [Virtual Memory & TLB]:
Compute the Effective Memory Access Time (EMAT) if memory access takes 80ns, TLB access takes 10ns, and the TLB hit ratio is 95%. Explain what happens during a TLB miss versus a page fault.

QUESTION 4 [Page Replacement & Thrashing]:
Define Belady's Anomaly and show how the First-In First-Out (FIFO) page replacement strategy can experience more page faults as physical frame allocation increases from 3 to 4 frames.
`

export interface PreloadedTopicData {
  name: string
  description: string
  strength: 'weak' | 'medium' | 'strong'
  score: number
  subtopics: { name: string; description: string }[]
}

export const PRELOADED_TOPICS: PreloadedTopicData[] = [
  {
    name: 'Virtual Memory & TLB Address Translation',
    description: 'Demand paging, Translation Lookaside Buffer hit ratios, Effective Memory Access Time (EMAT), and page fault handling.',
    strength: 'weak',
    score: 33,
    subtopics: [
      { name: 'Effective Memory Access Time (EMAT) Calculations', description: 'Computing mathematical memory latency under varying TLB hit rates.' },
      { name: 'Thrashing & Working Set Model', description: 'Mechanics of system collapse due to excessive page faulting.' },
      { name: 'Page Replacement Algorithms & Belady\'s Anomaly', description: 'FIFO, LRU, Optimal algorithms and frame anomalies.' },
    ],
  },
  {
    name: 'Deadlocks & The Banker\'s Algorithm',
    description: 'The four Coffman conditions, resource allocation graphs, safety sequences, and avoidance strategies.',
    strength: 'medium',
    score: 60,
    subtopics: [
      { name: 'The Four Necessary Conditions', description: 'Mutual exclusion, hold and wait, no preemption, circular wait.' },
      { name: 'Banker\'s Safety Algorithm Execution', description: 'Matrix allocations and safe execution vectors.' },
      { name: 'Deadlock Detection vs Prevention', description: 'Static prevention versus runtime avoidance trade-offs.' },
    ],
  },
  {
    name: 'Process Management & CPU Scheduling',
    description: 'Process states, context switching, Round Robin quantum tuning, and Multi-Level Feedback Queues.',
    strength: 'strong',
    score: 85,
    subtopics: [
      { name: 'Process Lifecycle & PCB', description: 'Process control blocks, state transitions, and register preservation.' },
      { name: 'CPU Scheduling Algorithms', description: 'FCFS, SJF, SRTF, and Round Robin performance metrics.' },
      { name: 'Inter-Process Communication (IPC)', description: 'Pipes, message queues, and shared memory synchronization.' },
    ],
  },
  {
    name: 'Concurrency Primitives & Critical Sections',
    description: 'Mutex locks, counting semaphores, monitors, and the classical synchronization dilemmas.',
    strength: 'medium',
    score: 55,
    subtopics: [
      { name: 'Mutex vs Counting Semaphores', description: 'Signal and wait operations, binary locks, and resource counts.' },
      { name: 'Classical Synchronization Problems', description: 'Producer-Consumer bounded buffers and Readers-Writers priority.' },
      { name: 'Atomic Operations', description: 'Compare-And-Swap (CAS) and Test-And-Set hardware primitives.' },
    ],
  },
  {
    name: 'Storage & File System Architecture',
    description: 'Unix inodes, disk scheduling algorithms (SCAN, C-SCAN), and storage allocation methods.',
    strength: 'strong',
    score: 90,
    subtopics: [
      { name: 'Unix Inode Structures', description: 'Direct, single indirect, double indirect pointer hierarchies.' },
      { name: 'Disk Scheduling Algorithms', description: 'SSTF, Elevator SCAN, and C-SCAN head optimization.' },
      { name: 'SSD vs Magnetic Disk Storage', description: 'Flash wear leveling, TRIM commands, and block erasure.' },
    ],
  },
]
