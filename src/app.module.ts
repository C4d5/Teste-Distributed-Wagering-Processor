
import { Module } from '@nestjs/common';

import { HealthModule } from './health.module';
import { MessagingModule } from './messaging.module';
import { WageringModule } from './wagering.module';

@Module({
  imports: [WageringModule, HealthModule, MessagingModule],
})
export class AppModule {}