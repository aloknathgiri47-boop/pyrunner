import { PrismaClient } from '@prisma/client'
import { Pool, neonConfig } from '@neondatabase/serverless'
import { PrismaNeon } from '@prisma/adapter-neon'
import { createPool } from '@neondatabase/serverless'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set')
  }

  // Check if we're using Neon (postgresql://)
  if (connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://')) {
    try {
      // Use the Neon serverless adapter for edge/serverless compatibility
      const pool = new Pool({ connectionString })
      const adapter = new PrismaNeon(pool)
      return new PrismaClient({ adapter } as any)
    } catch (e) {
      console.warn('Neon adapter failed, falling back to direct connection:', e)
      return new PrismaClient({ datasourceUrl: connectionString })
    }
  }

  // Fallback to SQLite (for local dev)
  return new PrismaClient()
}

export const db =
  globalForPrisma.prisma ??
  createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
