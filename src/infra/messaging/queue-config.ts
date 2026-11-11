
export const WAGER_TRANSACTIONS_QUEUE_URL =
  process.env.WAGER_TRANSACTIONS_QUEUE_URL ??
  'http://localhost:4566/000000000000/wager-transactions.fifo';

export const WAGER_EVENTS_QUEUE_URL =
  process.env.WAGER_EVENTS_QUEUE_URL ??
  'http://localhost:4566/000000000000/wager-events.fifo';

export const WAGER_TRANSACTIONS_CONSUMER_NAME = 'wager-transactions-consumer';