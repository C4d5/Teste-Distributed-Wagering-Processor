
import { Module } from '@nestjs/common';

import { pgPoolProvider } from './pool.provider';

@Module({
  providers: [pgPoolProvider],
  exports: [pgPoolProvider],
})
export class DatabaseModule {}