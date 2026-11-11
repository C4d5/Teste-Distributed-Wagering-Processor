
const BASE_BACKOFF_SECONDS = 5;
const MAX_BACKOFF_SECONDS = 300; 

export const OUTBOX_MAX_ATTEMPTS = 10;

export interface CreateOutboxMessageParams {
  id: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export interface ReconstituteOutboxMessageParams extends CreateOutboxMessageParams {
  occurredAt: Date;
  attempts: number;
  nextAttemptAt: Date;
  publishedAt: Date | null;
  lastError: string | null;
}

export class OutboxMessage {
  private constructor(
    private readonly props: {
      id: string;
      aggregateId: string;
      eventType: string;
      payload: Record<string, unknown>;
      occurredAt: Date;
      attempts: number;
      nextAttemptAt: Date;
      publishedAt: Date | null;
      lastError: string | null;
    },
  ) {}


  static create(params: CreateOutboxMessageParams): OutboxMessage {
    const now = new Date();
    return new OutboxMessage({
      ...params,
      occurredAt: now,
      attempts: 0,
      nextAttemptAt: now,
      publishedAt: null,
      lastError: null,
    });
  }

  static reconstitute(params: ReconstituteOutboxMessageParams): OutboxMessage {
    return new OutboxMessage(params);
  }

  markPublished(): OutboxMessage {
    return new OutboxMessage({ ...this.props, publishedAt: new Date() });
  }

 
  scheduleRetry(errorMessage: string): OutboxMessage {
    const attempts = this.props.attempts + 1;

    const delaySeconds = Math.min(
      MAX_BACKOFF_SECONDS,
      BASE_BACKOFF_SECONDS * 2 ** (attempts - 1),
    );

    const nextAttemptAt = new Date(Date.now() + delaySeconds * 1000);

    return new OutboxMessage({
      ...this.props,
      attempts,
      nextAttemptAt,
      lastError: errorMessage,
    });
  }

  get id(): string {
    return this.props.id;
  }

  get aggregateId(): string {
    return this.props.aggregateId;
  }

  get eventType(): string {
    return this.props.eventType;
  }

  get payload(): Record<string, unknown> {
    return this.props.payload;
  }

  get occurredAt(): Date {
    return this.props.occurredAt;
  }

  get attempts(): number {
    return this.props.attempts;
  }

  get nextAttemptAt(): Date {
    return this.props.nextAttemptAt;
  }

  get publishedAt(): Date | null {
    return this.props.publishedAt;
  }

  get lastError(): string | null {
    return this.props.lastError;
  }

  isPublished(): boolean {
    return this.props.publishedAt !== null;
  }
}