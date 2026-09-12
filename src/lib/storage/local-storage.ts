import type { StorageProvider, StorageFile } from './storage';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

class LocalStorageProvider implements StorageProvider {
  private uploadDir: string;

  constructor() {
    this.uploadDir = process.env.STORAGE_PATH || './uploads';
    // Ensure dir exists (only in Node environment)
    if (typeof window === 'undefined') {
      try {
        if (!fs.existsSync(this.uploadDir)) {
          fs.mkdirSync(this.uploadDir, { recursive: true });
        }
      } catch {}
    }
  }

  async upload(file: Buffer | Uint8Array, filename: string, mimeType: string): Promise<StorageFile> {
    const id = uuidv4();
    const ext = path.extname(filename) || '.jpg';
    const storedName = `${id}${ext}`;
    
    // In serverless/demo, we don't actually write file, just return mock URL
    // But try to write if possible
    if (typeof window === 'undefined') {
      try {
        const fullPath = path.join(this.uploadDir, storedName);
        fs.writeFileSync(fullPath, file);
      } catch (e) {
        console.warn('Local storage write failed, using mock', e);
      }
    }

    const url = `/uploads/${storedName}`;
    // For demo, return placeholder image if needed
    const mockUrl = `/api/placeholder/image?text=${encodeURIComponent(filename)}`;

    return {
      id,
      url: mockUrl, // Use mock URL for reliable demo
      path: storedName,
      size: file.length,
      mimeType,
    };
  }

  async delete(fileId: string): Promise<boolean> {
    try {
      if (typeof window === 'undefined') {
        const fullPath = path.join(this.uploadDir, fileId);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  async getUrl(fileId: string): Promise<string> {
    return `/uploads/${fileId}`;
  }

  async exists(fileId: string): Promise<boolean> {
    if (typeof window === 'undefined') {
      try {
        return fs.existsSync(path.join(this.uploadDir, fileId));
      } catch {
        return false;
      }
    }
    return true;
  }
}

export const localStorageProvider = new LocalStorageProvider();
