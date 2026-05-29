/**
 * db.js - Robust IndexedDB Database Layer for RetailFlow Offline Engine
 * Handles safe, high-capacity client-side transactional storage.
 */

class RetailFlowDB {
    constructor() {
        this.dbName = "RetailFlowOfflineDB";
        this.storeName = "keyval";
        this.db = null;
    }

    /**
     * Initializes the IndexedDB database.
     * Triggers auto-migration if legacy localStorage datasets are discovered.
     */
    init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onerror = (event) => {
                console.error("IndexedDB initialization error:", event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = async (event) => {
                this.db = event.target.result;
                console.log("IndexedDB engine loaded successfully.");
                
                try {
                    await this.runMigrationCheck();
                    resolve(this);
                } catch (err) {
                    console.error("Auto-migration during db startup failed:", err);
                    resolve(this); // resolve anyway to avoid breaking bootstrap
                }
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                    console.log(`Created new ObjectStore: '${this.storeName}'`);
                }
            };
        });
    }

    /**
     * Asynchronously retrieves a value by key.
     */
    get(key) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                resolve(null);
                return;
            }
            try {
                const transaction = this.db.transaction([this.storeName], "readonly");
                const store = transaction.objectStore(this.storeName);
                const request = store.get(key);

                request.onsuccess = () => resolve(request.result !== undefined ? request.result : null);
                request.onerror = (event) => reject(event.target.error);
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Asynchronously writes a value to a key.
     */
    set(key, value) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error("IndexedDB database is not initialized."));
                return;
            }
            try {
                const transaction = this.db.transaction([this.storeName], "readwrite");
                const store = transaction.objectStore(this.storeName);
                const request = store.put(value, key);

                request.onsuccess = () => resolve();
                request.onerror = (event) => reject(event.target.error);
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Imports legacy localStorage records on first boot.
     */
    async runMigrationCheck() {
        const isMigrated = localStorage.getItem('rf_idb_migrated') === 'true';
        if (isMigrated) return;

        console.log("Checking for legacy localStorage offline data to migrate to IndexedDB...");
        const legacyKeys = [
            'rf_mock_users',
            'rf_mock_profiles',
            'rf_mock_shops',
            'rf_mock_products',
            'rf_mock_suppliers',
            'rf_mock_customers',
            'rf_mock_purchases',
            'rf_mock_sales',
            'rf_mock_expenses',
            'rf_mock_payments',
            'rf_mock_returns',
            'rf_mock_invitations',
            'rf_last_backup_date'
        ];

        let migratedCount = 0;
        for (const key of legacyKeys) {
            const rawVal = localStorage.getItem(key);
            if (rawVal !== null) {
                try {
                    const parsed = JSON.parse(rawVal);
                    await this.set(key, parsed);
                    migratedCount++;
                } catch (e) {
                    // Try setting it as plain string if JSON parsing fails (e.g. for simple timestamps)
                    await this.set(key, rawVal);
                    migratedCount++;
                }
            }
        }

        if (migratedCount > 0) {
            console.log(`Successfully migrated ${migratedCount} tables/keys to IndexedDB storage!`);
        }
        localStorage.setItem('rf_idb_migrated', 'true');
    }
}

window.dbClient = new RetailFlowDB();
