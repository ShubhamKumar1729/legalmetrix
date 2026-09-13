/**
 * Evidence storage.
 *
 * Local disk provider by default. The interface is intentionally small so an S3 /
 * object-storage provider can be dropped in later without touching callers.
 */
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { extensionFor } from '../images/inspect';

export interface StoredImage {
  id: string;
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

export interface StorageProvider {
  save(buffer: Buffer, mimeType: string): Promise<StoredImage>;
  read(id: string): Promise<{ buffer: Buffer; mimeType: string } | null>;
  remove(id: string): Promise<boolean>;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

class LocalStorageProvider implements StorageProvider {
  private dir: string;

  constructor() {
    this.dir = path.resolve(process.env.STORAGE_PATH || './uploads');
    try {
      fs.mkdirSync(this.dir, { recursive: true });
    } catch (error) {
      console.warn('[storage] could not create upload directory:', (error as Error).message);
    }
  }

  private findFile(id: string): string | null {
    try {
      const entries = fs.readdirSync(this.dir);
      const match = entries.find((name) => name.startsWith(`${id}.`));
      return match ? path.join(this.dir, match) : null;
    } catch {
      return null;
    }
  }

  async save(buffer: Buffer, mimeType: string): Promise<StoredImage> {
    const id = uuidv4();
    const filename = `${id}.${extensionFor(mimeType)}`;
    fs.writeFileSync(path.join(this.dir, filename), buffer);
    return {
      id,
      url: `/api/images/${id}`,
      filename,
      size: buffer.length,
      mimeType,
    };
  }

  async read(id: string) {
    if (!/^[a-zA-Z0-9-]+$/.test(id)) return null;
    const file = this.findFile(id);
    if (!file) return null;
    const ext = path.extname(file).slice(1).toLowerCase();
    return {
      buffer: fs.readFileSync(file),
      mimeType: MIME_BY_EXTENSION[ext] || 'application/octet-stream',
    };
  }

  async remove(id: string) {
    const file = this.findFile(id);
    if (!file) return false;
    try {
      fs.unlinkSync(file);
      return true;
    } catch {
      return false;
    }
  }
}

class StorageRegistry {
  private providers = new Map<string, StorageProvider>();
  private defaultProvider: string;

  constructor() {
    this.providers.set('local', new LocalStorageProvider());
    this.defaultProvider = process.env.STORAGE_TYPE || 'local';
  }

  get(): StorageProvider {
    return this.providers.get(this.defaultProvider) || this.providers.get('local')!;
  }

  save(buffer: Buffer, mimeType: string) {
    return this.get().save(buffer, mimeType);
  }

  read(id: string) {
    return this.get().read(id);
  }

  remove(id: string) {
    return this.get().remove(id);
  }
}

export const storage = new StorageRegistry();
