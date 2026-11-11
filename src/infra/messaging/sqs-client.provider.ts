
import { Provider } from '@nestjs/common';
import { SQSClient } from '@aws-sdk/client-sqs';

export const SQS_CLIENT = 'SQS_CLIENT';

export const sqsClientProvider: Provider = {
  provide: SQS_CLIENT,
  useFactory: (): SQSClient =>
    new SQSClient({
      region: process.env.AWS_REGION ?? 'us-east-1',
      endpoint: process.env.SQS_ENDPOINT ?? 'http://localhost:4566',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'test',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'test',
      },
    }),
};