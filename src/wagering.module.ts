
import { Module } from '@nestjs/common';

import { WageringCoreModule } from './wagering-core.module';
import { WageringController } from './presentation/controllers/wagering.controller';

@Module({
  imports: [WageringCoreModule],
  controllers: [WageringController],
})
export class WageringModule {}