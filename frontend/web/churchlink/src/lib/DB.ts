/**
 * IndexedDB wrapper for frontend caching
 */
export class DB {
  private static db: IDBDatabase | null = null;
  private static dbName = 'ChurchLinkCache';
  private static encryptionDisabled: Set<string> = new Set();

  /**
   * Initialize IndexedDB database
   */
  public static async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      // Open without specifying version to use the current version
      const request = indexedDB.open(this.dbName);

      request.onerror = () => {
        console.error('IndexedDB error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        // Create object stores as needed - they'll be created when first accessed
        this.db = db;
      };
    });
  }

  /**
   * Set encryption for a specific store (placeholder - not implemented for performance)
   */
  public static setEncryptionForStore(storeName: string, enabled: boolean): void {
    if (!enabled) {
      this.encryptionDisabled.add(storeName);
    } else {
      this.encryptionDisabled.delete(storeName);
    }
  }

  /**
   * Ensure object store exists
   */
  private static ensureStore(storeName: string): IDBObjectStore {
    if (!this.db) throw new Error('DB not initialized');

    if (!this.db.objectStoreNames.contains(storeName)) {
      // Create store if it doesn't exist
      const version = this.db.version + 1;
      this.db.close();

      return new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName, version);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          this.db = request.result;
          resolve(this.db.transaction([storeName], 'readwrite').objectStore(storeName));
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          db.createObjectStore(storeName, { keyPath: 'id' });
        };
      }) as any;
    }

    return this.db.transaction([storeName], 'readwrite').objectStore(storeName);
  }

  /**
   * Get item from store
   */
  public static async get(storeName: string, key: string | number): Promise<any> {
    await this.init();
    const store = this.ensureStore(storeName);

    // If we don't have a real IDBObjectStore (or it doesn't support get),
    // bail out gracefully instead of throwing.
    if (!store || typeof (store as any).get !== 'function') {
      // optionally log here if you want to see when this happens
      // console.warn('IndexedDB store not ready, returning null');
      return null;
    }

    return new Promise((resolve, reject) => {
      try {
        const request = (store as any).get(key);

        request.onsuccess = () => {
          resolve(request.result ?? null);
        };

        request.onerror = () => {
          reject(request.error);
        };
      } catch (err) {
        // Handles things like "store.get is not a function" or any other sync error
        resolve(null);
      }
    });
  }


  /**
   * Put item in store
   */
  public static async put(storeName: string, item: any): Promise<void> {
    await this.init();
    const store = this.ensureStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.put(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete item from store
   */
  public static async delete(storeName: string, key: string | number): Promise<void> {
    await this.init();
    const store = this.ensureStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear entire store
   */
  public static async clear(storeName: string): Promise<void> {
    await this.init();
    const store = this.ensureStore(storeName);

    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
