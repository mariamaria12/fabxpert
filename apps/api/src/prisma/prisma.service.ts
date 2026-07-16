import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/** Injection token for the shared Prisma client instance. */
@Injectable()
export class PrismaService extends PrismaClient {}
