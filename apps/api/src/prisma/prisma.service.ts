import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Injection token for the shared Prisma client.
 *
 * Do NOT register this class via `providers: [PrismaService]` — Nest would
 * construct an uncapped second client. Use the factory in PrismaModule.
 */
@Injectable()
export class PrismaService extends PrismaClient {}
