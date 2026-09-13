/**
 * In-memory data store.
 *
 * This is a real (non-persistent) store used when MongoDB is not reachable, so the
 * application stays usable in a development sandbox. It starts EMPTY: no business
 * records are ever created here automatically.
 */
import { v4 as uuidv4 } from 'uuid';
import type {
  AuditLog,
  EcommerceListing,
  Inspection,
  Product,
  RegulatoryRule,
  Report,
  User,
} from '@/types';

export class MemoryCollection<T extends { id: string }> {
  private items = new Map<string, T>();

  async create(data: Omit<T, 'id'> & Partial<{ id: string }>): Promise<T> {
    const id = (data as { id?: string }).id || uuidv4();
    const item = { ...data, id } as T;
    this.items.set(id, item);
    return item;
  }

  async findById(id: string): Promise<T | null> {
    return this.items.get(id) || null;
  }

  all(): T[] {
    return Array.from(this.items.values());
  }

  async update(id: string, patch: Partial<T>): Promise<T | null> {
    const existing = this.items.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...patch, id } as T;
    this.items.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.items.delete(id);
  }

  async clear(): Promise<void> {
    this.items.clear();
  }
}

export const memoryDB = {
  users: new MemoryCollection<User & { passwordHash?: string }>(),
  inspections: new MemoryCollection<Inspection>(),
  products: new MemoryCollection<Product>(),
  reports: new MemoryCollection<Report>(),
  rules: new MemoryCollection<RegulatoryRule>(),
  auditLogs: new MemoryCollection<AuditLog>(),
  ecommerceListings: new MemoryCollection<EcommerceListing>(),
};

export type MemoryDB = typeof memoryDB;
