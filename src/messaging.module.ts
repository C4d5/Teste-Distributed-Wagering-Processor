
import { Module } from '@nestjs/common';

import { DatabaseModule } from './infra/database/database.module';
import { PostgresInboxRepository } from './infra/database/postgres-inbox.repository';
import { PostgresOutboxRepository } from './infra/database/postgres-outbox.repository';
import { OutboxPublisherService } from './infra/messaging/outbox-publisher.service';
import { sqsClientProvider } from './infra/messaging/sqs-client.provider';
import { WagerTransactionConsumerService } from './infra/messaging/wager-transaction-consumer.service';
import { WageringCoreModule } from './wagering-core.module';

@Module({
  imports: [DatabaseModule, WageringCoreModule],
  providers: [
    sqsClientProvider,
    PostgresInboxRepository,
    PostgresOutboxRepository,
    WagerTransactionConsumerService,
    OutboxPublisherService,
  ],
})
export class MessagingModule {}