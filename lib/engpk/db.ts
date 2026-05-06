/**
 * engpk · Prisma client 单例
 *
 * Next.js 在 dev 时会热重载，避免每次都新建 client 导致连接耗尽：
 *   - 全局存一个实例
 *   - prod 直接 new
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
