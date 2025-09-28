import { DB } from './DB';

type AvatarRow = {
  id: number | string;
  data: string; // data URL (base64)
  timestamp: number; // ms since epoch
  url?: string | null;
};


export class AvatarCache {
  private static readonly STORE = 'avatars';
  private static readonly TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
  private static initPromise: Promise<boolean> | null = null;
  private static memory: Map<string | number, AvatarRow> = new Map();
  private static pending: Map<string | number, Promise<string | null>> = new Map();

  /**
   * Initialize the cache system
   */
  public static async init(): Promise<boolean> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      await DB.init();
      // Avatars are not sensitive; disable encryption to avoid perf overhead
      try { DB.setEncryptionForStore(this.STORE, false); } catch {}
      return true;
    })();
    try { return await this.initPromise; } finally { this.initPromise = null; }
  }

  /**
   * Check if a timestamp is expired
   */
  private static isExpired(ts: number): boolean {
    return Date.now() - ts > this.TTL_MS;
  }

  /**
   * Get cached avatar by user ID
   */
  public static async get(userId: number | string): Promise<string | null> {
    await this.init();
    // Check memory cache first
    const mem = this.memory.get(userId);
    if (mem && !this.isExpired(mem.timestamp)) return mem.data;

    // Check IndexedDB
    const row = (await DB.get(this.STORE, userId)) as AvatarRow | null;
    if (!row) return null;

    // Check expiration
    if (!row.timestamp || this.isExpired(row.timestamp)) {
      try { await DB.delete(this.STORE, userId); } catch {}
      return null;
    }

    // Update memory cache
    this.memory.set(userId, row);
    return row.data || null;
  }

  /**
   * Store avatar in cache
   */
  public static async put(userId: number | string, dataUrl: string, url?: string | null): Promise<void> {
    await this.init();
    const payload: AvatarRow = {
      id: userId,
      data: dataUrl,
      timestamp: Date.now(),
      url: url ?? null
    };
    await DB.put(this.STORE, payload);
    this.memory.set(userId, payload);
  }

  /**
   * Get cached avatar by any of the provided IDs (aliases)
   */
  public static async getByAny(ids: Array<number | string | undefined | null>): Promise<string | null> {
    await this.init();
    for (const id of ids) {
      if (id == null) continue;
      const v = await this.get(id);
      if (v) return v;
    }
    return null;
  }

  /**
   * Store avatar under multiple aliases
   */
  public static async putUnderAliases(
    primaryId: number | string,
    dataUrl: string,
    url?: string | null,
    aliases?: Array<number | string | undefined | null>
  ): Promise<void> {
    await this.put(primaryId, dataUrl, url);
    if (aliases && aliases.length) {
      for (const a of aliases) {
        if (a == null) continue;
        try {
          const existing = await this.get(a);
          if (!existing) await this.put(a, dataUrl, url);
        } catch {}
      }
    }
  }

  /**
   * Fetch image from network and cache it
   */
  public static async fetchAndCache(
    userId: number | string,
    url?: string | null,
    aliases?: Array<number | string | undefined | null>
  ): Promise<string | null> {
    await this.init();
    if (!url) return null;

    // Prevent duplicate fetches
    if (this.pending.has(userId)) return this.pending.get(userId)!;

    const job = (async () => {
      try {
        const resp = await fetch(url);
        if (!resp.ok) {
          if (resp.status === 429) return null; // Rate limited
          return null;
        }

        const blob = await resp.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('reader error'));
          reader.readAsDataURL(blob);
        });

        await this.putUnderAliases(userId, dataUrl, url, aliases);
        return dataUrl;
      } catch {
        return null;
      } finally {
        this.pending.delete(userId);
      }
    })();

    this.pending.set(userId, job);
    return job;
  }

  /**
   * Get cached avatar or fetch and cache if not available
   */
  public static async getOrFetch(
    userId: number | string,
    url?: string | null,
    aliases?: Array<number | string | undefined | null>
  ): Promise<string | null> {
    const cached = await this.getByAny([userId, ...(aliases || [])]);
    if (cached) return cached;
    return await this.fetchAndCache(userId, url, aliases);
  }
}
