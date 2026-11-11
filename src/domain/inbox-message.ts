
export interface CreateInboxMessageParams {
  id: string;
  messageId: string;
  consumerName: string;
  payloadHash: string;
}

export interface ReconstituteInboxMessageParams extends CreateInboxMessageParams {
  receivedAt: Date;
  processedAt: Date | null;
}

export class InboxMessage {
  private constructor(
    private readonly props: {
      id: string;
      messageId: string;
      consumerName: string;
      payloadHash: string;
      receivedAt: Date;
      processedAt: Date | null;
    },
  ) {}

  static create(params: CreateInboxMessageParams): InboxMessage {
    return new InboxMessage({
      ...params,
      receivedAt: new Date(),
      processedAt: null,
    });
  }

  static reconstitute(params: ReconstituteInboxMessageParams): InboxMessage {
    return new InboxMessage(params);
  }


  markProcessed(): InboxMessage {
    return new InboxMessage({ ...this.props, processedAt: new Date() });
  }

  get id(): string {
    return this.props.id;
  }

  get messageId(): string {
    return this.props.messageId;
  }

  get consumerName(): string {
    return this.props.consumerName;
  }

  get payloadHash(): string {
    return this.props.payloadHash;
  }

  get receivedAt(): Date {
    return this.props.receivedAt;
  }

  get processedAt(): Date | null {
    return this.props.processedAt;
  }

  isProcessed(): boolean {
    return this.props.processedAt !== null;
  }
}