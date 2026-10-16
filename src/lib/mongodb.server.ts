import "@tanstack/react-start/server-only";
import { MongoClient, type Db } from "mongodb";

// Share the connection promise across requests and local development reloads.
const cache = globalThis as typeof globalThis & {
  __markoMongoClientPromise?: Promise<MongoClient>;
};

export function getMongoClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGODB_URI in your server environment.");

  if (!cache.__markoMongoClientPromise) {
    const client = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
    });

    const pending: Promise<MongoClient> = client.connect().catch(async (error) => {
      await client.close().catch(() => undefined);
      // Let a later request retry if this connection attempt failed.
      if (cache.__markoMongoClientPromise === pending) {
        delete cache.__markoMongoClientPromise;
      }
      throw error;
    });

    cache.__markoMongoClientPromise = pending;
  }

  return cache.__markoMongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const databaseName = process.env.MONGODB_DB;
  if (!databaseName) throw new Error("Missing MONGODB_DB in your server environment.");
  const client = await getMongoClient();
  return client.db(databaseName);
}
