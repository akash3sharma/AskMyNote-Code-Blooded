import mongoose from "mongoose";

import { env } from "@/lib/env";

declare global {
  var mongooseCache: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  } | null;
  var memoryMongoServerUri: string | null;
  var memoryMongoServer:
    | {
        getUri: (dbName?: string) => string;
      }
    | null;
}

const cached = global.mongooseCache ?? { conn: null, promise: null };

global.mongooseCache = cached;
global.memoryMongoServerUri = global.memoryMongoServerUri ?? null;
global.memoryMongoServer = global.memoryMongoServer ?? null;

async function connectWithUri(uri: string) {
  return mongoose.connect(uri, {
    dbName: "askmynotes",
    maxPoolSize: 10,
  });
}

export async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = connectWithUri(env.MONGODB_URI).catch(async (error) => {
      if (env.NODE_ENV !== "development") {
        throw error;
      }

      if (!global.memoryMongoServerUri) {
        const { MongoMemoryServer } = await import("mongodb-memory-server");
        global.memoryMongoServer = await MongoMemoryServer.create({ instance: { dbName: "askmynotes" } });
        global.memoryMongoServerUri = global.memoryMongoServer.getUri("askmynotes");
        console.warn("[db] Falling back to in-memory MongoDB for local development.");
      }

      return connectWithUri(global.memoryMongoServerUri);
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
