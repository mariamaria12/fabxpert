import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PersonController } from './person.controller';
import { PersonService } from './person.service';

@Module({
  imports: [PrismaModule],
  controllers: [PersonController],
  providers: [PersonService],
})
export class PersonModule {}
