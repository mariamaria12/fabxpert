import { Global, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { disconnectPrismaClient, getPrismaClient } from './prisma-client.singleton';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useFactory: () => getPrismaClient(),
    },
  ],
  exports: [PrismaService],
})
export class PrismaModule implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await getPrismaClient().$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await disconnectPrismaClient();
  }
}
