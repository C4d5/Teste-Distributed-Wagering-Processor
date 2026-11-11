
import { Provider } from '@nestjs/common';

import { createPool } from './pool';

export const PG_POOL = 'PG_POOL';

export const pgPoolProvider: Provider = {
  provide: PG_POOL,
  useFactory: () => createPool(),
};