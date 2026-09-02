import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AssemblyController, ProjectAssemblyController } from './assembly.controller';
import { AssemblyService } from './assembly.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProjectAssemblyController, AssemblyController],
  providers: [AssemblyService],
  exports: [AssemblyService],
})
export class AssemblyModule {}
