import mongoose from 'mongoose';

/**
 * MongoDB connection with graceful, FAST fallback to the in-memory demo store.
 *
 * Rules:
 *  - Never block a request for more than ~2s waiting on a DB that isn't there.
 *  - Remember a failed attempt (negative cache) so every API call doesn't pay it again.
 *  - bufferCommands:false so a query can never silently queue forever.
 */
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sih-compliance';

let isConnected = false;
let connectAttempted = false;
let inflight: Promise<boolean> | null = null;

async function attemptConnect(): Promise<boolean> {
  const state = () => mongoose.connection.readyState as number;
  try {
    if (state() === 1) {
      isConnected = true;
      return true;
    }
    if (state() === 0) {
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 2000,
        bufferCommands: false,
      });
    }
    isConnected = state() === 1;
    return isConnected;
  } catch (e) {
    console.log('MongoDB not available — using in-memory demo store.');
    isConnected = false;
    return false;
  }
}

export async function connectDB(): Promise<boolean> {
  if (isConnected) return true;
  if (connectAttempted) return false; // failed already → don't retry on every request
  if (!inflight) {
    inflight = attemptConnect().finally(() => {
      connectAttempted = true;
      inflight = null;
    });
  }
  return inflight;
}

/** Let tests/demo tooling reset the negative cache. */
export function resetDBAttempt() {
  connectAttempted = false;
}

export function isDBConnected() {
  return isConnected && mongoose.connection.readyState === 1;
}
