import { connectDB, datastoreKind } from '../db/connection';
import { getBootstrapSettings } from '../db/bootstrap';
import { aiRegistry } from '../ai/provider';
import { db } from '../db/repository';
import { ALLOWED_MIME_TYPES, MAX_IMAGE_BYTES, MIN_DIMENSION_PX } from '../images/inspect';

export interface SystemStatus {
  datastore: 'mongodb' | 'memory';
  mongodbConfigured: boolean;
  ai: {
    providers: { name: string; version: string; development: boolean }[];
    developmentMode: boolean;
  };
  rulesPublished: number;
  userCount: number;
  bootstrapConfigured: boolean;
  uploads: {
    allowedFormats: string[];
    maxBytes: number;
    minDimensionPx: number;
  };
}

/** Real, current system status — used by the login screen and the Admin page. */
export async function getSystemStatus(): Promise<SystemStatus> {
  await connectDB();

  const [rulesPublished, userCount] = await Promise.all([
    db.rules.count({ enabled: true, status: 'PUBLISHED' }),
    db.users.count(),
  ]);

  const providers = aiRegistry.list();
  const active = aiRegistry.get();

  return {
    datastore: datastoreKind(),
    mongodbConfigured: Boolean(process.env.MONGODB_URI),
    ai: {
      providers,
      developmentMode: active.isDevelopmentProvider === true,
    },
    rulesPublished,
    userCount,
    bootstrapConfigured: getBootstrapSettings().configured,
    uploads: {
      allowedFormats: ALLOWED_MIME_TYPES,
      maxBytes: MAX_IMAGE_BYTES,
      minDimensionPx: MIN_DIMENSION_PX,
    },
  };
}
