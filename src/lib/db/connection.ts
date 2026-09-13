import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || '';

let attempted = false;

/**
 * Connect to MongoDB when a connection string is configured.
 * Returns false (and leaves the app running on the in-memory store) when no URI is
 * configured or the server is unreachable — never throws.
 */
export async function connectDB(): Promise<boolean> {
  if (mongoose.connection.readyState === 1) return true;
  if (!MONGODB_URI) {
    if (!attempted) {
      attempted = true;
      console.info('[db] MONGODB_URI not set — using in-memory store (data is not persisted)');
    }
    return false;
  }

  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 3000 });
      console.info('[db] MongoDB connected');
    }
    return isDBConnected();
  } catch (error) {
    if (!attempted) {
      attempted = true;
      console.warn('[db] MongoDB unavailable — using in-memory store:', (error as Error).message);
    }
    return false;
  }
}

export function isDBConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export function datastoreKind(): 'mongodb' | 'memory' {
  return isDBConnected() ? 'mongodb' : 'memory';
}
