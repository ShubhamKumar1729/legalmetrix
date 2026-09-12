import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sih-compliance';

let isConnected = false;

export async function connectDB(): Promise<boolean> {
  if (isConnected) return true;
  
  // If no URI or explicitly disabled, fallback to memory
  if (!MONGODB_URI || process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    // In demo mode, we use memory store by default, but try mongo if available
    try {
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(MONGODB_URI, {
          serverSelectionTimeoutMS: 2000,
        });
        isConnected = true;
        console.log('MongoDB connected');
        return true;
      }
    } catch (e) {
      console.log('MongoDB not available, using in-memory store');
      return false;
    }
  }

  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI);
      isConnected = true;
      console.log('MongoDB connected');
    } else {
      isConnected = true;
    }
    return true;
  } catch (error) {
    console.warn('MongoDB connection failed, using in-memory store:', error);
    return false;
  }
}

export function isDBConnected() {
  return isConnected && mongoose.connection.readyState === 1;
}
