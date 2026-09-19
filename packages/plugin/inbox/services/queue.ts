import { ErrorService, ErrorSeverity } from './error-service';
import { IdService } from './id-service';
import { TFile } from "obsidian";

const MAX_CONCURRENT_TASKS = 5;

export interface QueueTaskMetadata {
  hash: string;
}

interface QueueItem<T> {
  hash: string;
  data: T;
  metadata?: QueueTaskMetadata;
  addedAt: number;
}

interface QueueOptions<T> {
  concurrency?: number;
  timeout?: number;
  onProcess: (item: T, metadata?: QueueTaskMetadata) => Promise<void>;
  onComplete?: (item: T, metadata?: QueueTaskMetadata) => void;
  onError?: (error: Error, item: T, metadata?: QueueTaskMetadata) => void;
}

interface QueueStatus {
  queued: number;
  processing: number;
  completed: number;
  errors: number;
  bypassed: number;
  total: number;
}

export class Queue<T> {
  private items: Map<string, QueueItem<T>> = new Map();
  private processing: Set<string> = new Set();
  private options: Required<QueueOptions<T>>;
  private idService: IdService;
  
  private completedItems: Set<string> = new Set();
  private errorItems: Set<string> = new Set();
  private bypassedItems: Set<string> = new Set();

  private queue: string[] = [];

  constructor(options: QueueOptions<T>) {
    this.options = {
      concurrency: MAX_CONCURRENT_TASKS,
      timeout: 30000,
      onComplete: options.onComplete || ((item: T, metadata?: QueueTaskMetadata) => {}),
      onError: options.onError || ((error: Error, item: T, metadata?: QueueTaskMetadata) => {}),
      ...options
    };
    this.idService = IdService.getInstance();
  }

  public add(file: TFile, { metadata = {} } = {}): string {
    const hash = this.idService.generateFileHash(file);
    const item: QueueItem<T> = {
      hash,
      data: file as unknown as T,
      metadata: { ...metadata, hash },
      addedAt: Date.now()
    };

    this.items.set(hash, item);
    this.queue.push(hash);
    
    if (this.processing.size < this.options.concurrency) {
      void this.processNext();
    }

    return hash;
  }

  private async processNext(): Promise<void> {
    if (this.processing.size >= this.options.concurrency || this.queue.length === 0) {
      return;
    }

    const hash = this.queue.shift();
    if (!hash) return;

    const item = this.items.get(hash);
    if (!item) return;

    this.processing.add(hash);

    try {
      const timeoutPromise = new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error('Processing timeout')), this.options.timeout);
      });

      await Promise.race([
        this.options.onProcess(item.data, item.metadata),
        timeoutPromise
      ]);

      this.completedItems.add(hash);
      this.items.delete(hash);
      this.options.onComplete?.(item.data, item.metadata);
    } catch (error) {
      this.errorItems.add(hash);
      this.items.delete(hash);
      ErrorService.getInstance().handleError({
        message: 'Queue processing error',
        severity: ErrorSeverity.HIGH,
        error: error as Error,
        context: {
          itemId: hash,
          metadata: item.metadata
        }
      });
      this.options.onError?.(error as Error, item.data, item.metadata);
    } finally {
      this.processing.delete(hash);

      if (this.queue.length > 0) {
        void this.processNext();
      }
    }
  }

  public remove(hash: string): boolean {
    if (!this.idService.validateHash(hash) || this.processing.has(hash)) {
      return false;
    }

    const index = this.queue.indexOf(hash);
    if (index !== -1) {
      this.queue.splice(index, 1);
      this.items.delete(hash);
      return true;
    }

    return false;
  }

  public clear(): void {
    this.queue = [];
    this.processing.clear();
    this.completedItems.clear();
    this.errorItems.clear();
    this.bypassedItems.clear();
  }

  public get size(): number {
    return this.items.size;
  }

  public get activeCount(): number {
    return this.processing.size;
  }

  public getItem(hash: string): QueueItem<T> | undefined {
    return this.items.get(hash);
  }

  public getStats(): QueueStatus {
    return {
      queued: this.queue.length,
      processing: this.processing.size,
      completed: this.completedItems.size,
      errors: this.errorItems.size,
      bypassed: this.bypassedItems.size,
      total: this.items.size + this.completedItems.size + this.errorItems.size + this.bypassedItems.size
    };
  }

  public bypass(hash: string): boolean {
    if (!this.idService.validateHash(hash) || this.processing.has(hash)) {
      return false;
    }

    const index = this.queue.indexOf(hash);
    if (index !== -1) {
      this.queue.splice(index, 1);
      const item = this.items.get(hash);
      if (item) {
        this.bypassedItems.add(hash);
        this.items.delete(hash);
        return true;
      }
    }

    return false;
  }
} 