/**
 * Storage Abstraction - Compatible with S3 later
 */

export interface StorageFile {
  id: string;
  url: string;
  path: string;
  size: number;
  mimeType: string;
}

export interface StorageProvider {
  upload(file: Buffer | Uint8Array, filename: string, mimeType: string, metadata?: any): Promise<StorageFile>;
  delete(fileId: string): Promise<boolean>;
  getUrl(fileId: string): Promise<string>;
  exists(fileId: string): Promise<boolean>;
}

import { localStorageProvider } from './local-storage';

class StorageRegistry {
  private providers: Map<string, StorageProvider> = new Map();
  private defaultProvider: string;

  constructor() {
    this.providers.set('local', localStorageProvider);
    this.defaultProvider = process.env.STORAGE_TYPE || 'local';
  }

  getProvider(name?: string): StorageProvider {
    const providerName = name || this.defaultProvider;
    return this.providers.get(providerName) || localStorageProvider;
  }

  async upload(file: Buffer | Uint8Array, filename: string, mimeType: string, metadata?: any): Promise<StorageFile> {
    const provider = this.getProvider();
    return provider.upload(file, filename, mimeType, metadata);
  }
}

export const storage = new StorageRegistry();
