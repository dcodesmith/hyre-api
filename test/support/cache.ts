import { Booking, Car, Payment, User } from "@prisma/client";
import { logger } from "./logger";

export class Cache {
  private cache = new Map<string, any>();

  // Booking methods
  get booking() {
    return {
      set: (key: string, value: Booking): Booking => {
        this.cache.set(`booking:${key}`, value);
        // Also store by ID for easy lookup
        if (value && typeof value === "object" && value.id) {
          this.cache.set(`booking:id:${value.id}`, value);
        }
        logger.debug(`Stored booking with key "${key}"`);
        return value;
      },

      get: (key: string): Booking | null => {
        return this.cache.get(`booking:${key}`) || null;
      },

      getOrFail: (key: string): Booking => {
        const fullKey = `booking:${key}`;
        const value = this.cache.get(fullKey);
        if (value === undefined) {
          const availableKeys = this.getKeysForNamespace("booking");
          throw new Error(
            `❌ Booking not found!\n` +
              `   Key: "${key}"\n` +
              `   Available booking keys: [${availableKeys.join(", ")}]\n` +
              `   Total cached items: ${this.cache.size}`,
          );
        }
        return value;
      },

      exists: (key: string) => {
        return this.cache.has(`booking:${key}`);
      },

      delete: (key: string) => {
        return this.cache.delete(`booking:${key}`);
      },

      findById: (id: string): Booking | null => {
        return this.cache.get(`booking:id:${id}`) || null;
      },

      findByIdOrFail: (id: string): Booking => {
        const value = this.cache.get(`booking:id:${id}`);
        if (!value) {
          throw new Error(`❌ Booking not found with id: ${id}`);
        }
        return value;
      },
    };
  }

  // Customer methods (aliased to user for backward compatibility)
  get customer() {
    return {
      set: (key: string, value: User): User => {
        this.cache.set(`customer:${key}`, value);
        if (value && typeof value === "object" && value.id) {
          this.cache.set(`customer:id:${value.id}`, value);
        }
        logger.debug(`Stored customer with key "${key}"`);
        return value;
      },

      get: (key: string): User | null => {
        return this.cache.get(`customer:${key}`) || null;
      },

      getOrFail: (key: string): User => {
        const fullKey = `customer:${key}`;
        const value = this.cache.get(fullKey);
        if (value === undefined) {
          const availableKeys = this.getKeysForNamespace("customer");
          throw new Error(
            `❌ Customer not found!\n` +
              `   Key: "${key}"\n` +
              `   Available customer keys: [${availableKeys.join(", ")}]\n` +
              `   Total cached items: ${this.cache.size}`,
          );
        }
        return value;
      },

      exists: (key: string): boolean => {
        return this.cache.has(`customer:${key}`);
      },

      delete: (key: string): boolean => {
        return this.cache.delete(`customer:${key}`);
      },

      findById: (id: string): User | null => {
        return this.cache.get(`customer:id:${id}`) || null;
      },

      findByIdOrFail: (id: string): User => {
        const value = this.cache.get(`customer:id:${id}`);
        if (!value) {
          throw new Error(`❌ Customer not found with id: ${id}`);
        }
        return value;
      },
    };
  }

  // Car methods
  get car() {
    return {
      set: (key: string, value: Car): Car => {
        this.cache.set(`car:${key}`, value);
        if (value && typeof value === "object" && value.id) {
          this.cache.set(`car:id:${value.id}`, value);
        }
        logger.debug(`Stored car with key "${key}"`);
        return value;
      },

      get: (key: string): Car | null => {
        return this.cache.get(`car:${key}`) || null;
      },

      getOrFail: (key: string): Car => {
        const fullKey = `car:${key}`;
        const value = this.cache.get(fullKey);
        if (value === undefined) {
          const availableKeys = this.getKeysForNamespace("car");
          throw new Error(
            `❌ Car not found!\n` +
              `   Key: "${key}"\n` +
              `   Available car keys: [${availableKeys.join(", ")}]\n` +
              `   Total cached items: ${this.cache.size}`,
          );
        }
        return value;
      },

      exists: (key: string): boolean => {
        return this.cache.has(`car:${key}`);
      },

      delete: (key: string): boolean => {
        return this.cache.delete(`car:${key}`);
      },

      findById: (id: string): Car | null => {
        return this.cache.get(`car:id:${id}`) || null;
      },

      findByIdOrFail: (id: string): Car => {
        const value = this.cache.get(`car:id:${id}`);
        if (!value) {
          throw new Error(`❌ Car not found with id: ${id}`);
        }
        return value;
      },
    };
  }

  // Driver methods (aliased to user for backward compatibility)
  get driver() {
    return {
      set: (key: string, value: User): User => {
        this.cache.set(`driver:${key}`, value);
        if (value && typeof value === "object" && value.id) {
          this.cache.set(`driver:id:${value.id}`, value);
        }
        logger.debug(`Stored driver with key "${key}"`);
        return value;
      },

      get: (key: string): User | null => {
        return this.cache.get(`driver:${key}`) || null;
      },

      getOrFail: (key: string): User => {
        const fullKey = `driver:${key}`;
        const value = this.cache.get(fullKey);
        if (value === undefined) {
          const availableKeys = this.getKeysForNamespace("driver");
          throw new Error(
            `❌ Driver not found!\n` +
              `   Key: "${key}"\n` +
              `   Available driver keys: [${availableKeys.join(", ")}]\n` +
              `   Total cached items: ${this.cache.size}`,
          );
        }
        return value;
      },

      exists: (key: string): boolean => {
        return this.cache.has(`driver:${key}`);
      },

      delete: (key: string): boolean => {
        return this.cache.delete(`driver:${key}`);
      },

      findById: (id: string): User | null => {
        return this.cache.get(`driver:id:${id}`) || null;
      },

      findByIdOrFail: (id: string): User => {
        const value = this.cache.get(`driver:id:${id}`);
        if (!value) {
          throw new Error(`❌ Driver not found with id: ${id}`);
        }
        return value;
      },
    };
  }

  // User methods
  get user() {
    return {
      set: (key: string, value: User): User => {
        this.cache.set(`user:${key}`, value);
        if (value && typeof value === "object" && value.id) {
          this.cache.set(`user:id:${value.id}`, value);
        }
        return value;
      },

      get: (key: string): User | null => {
        return this.cache.get(`user:${key}`) || null;
      },

      getOrFail: (key: string): User => {
        const fullKey = `user:${key}`;
        const value = this.cache.get(fullKey);
        if (value === undefined) {
          const availableKeys = this.getKeysForNamespace("user");
          throw new Error(
            `❌ User not found!\n` +
              `   Key: "${key}"\n` +
              `   Available user keys: [${availableKeys.join(", ")}]\n` +
              `   Total cached items: ${this.cache.size}`,
          );
        }
        return value;
      },

      exists: (key: string): boolean => {
        return this.cache.has(`user:${key}`);
      },

      delete: (key: string): boolean => {
        return this.cache.delete(`user:${key}`);
      },

      findById: (id: string): User | null => {
        return this.cache.get(`user:id:${id}`) || null;
      },

      findByIdOrFail: (id: string): User => {
        const value = this.cache.get(`user:id:${id}`);
        if (!value) {
          throw new Error(`❌ User not found with id: ${id}`);
        }
        return value;
      },
    };
  }

  // Payment methods
  get payment() {
    return {
      set: (key: string, value: Payment): Payment => {
        this.cache.set(`payment:${key}`, value);
        if (value && typeof value === "object" && value.id) {
          this.cache.set(`payment:id:${value.id}`, value);
        }
        logger.debug(`Stored payment with key "${key}"`);
        return value;
      },

      get: (key: string): Payment | null => {
        return this.cache.get(`payment:${key}`) || null;
      },

      getOrFail: (key: string): Payment => {
        const fullKey = `payment:${key}`;
        const value = this.cache.get(fullKey);
        if (value === undefined) {
          const availableKeys = this.getKeysForNamespace("payment");
          throw new Error(
            `❌ Payment not found!\n` +
              `   Key: "${key}"\n` +
              `   Available payment keys: [${availableKeys.join(", ")}]\n` +
              `   Total cached items: ${this.cache.size}`,
          );
        }
        return value;
      },

      exists: (key: string): boolean => {
        return this.cache.has(`payment:${key}`);
      },

      delete: (key: string): boolean => {
        return this.cache.delete(`payment:${key}`);
      },

      findById: (id: string): Payment | null => {
        return this.cache.get(`payment:id:${id}`) || null;
      },

      findByIdOrFail: (id: string): Payment => {
        const value = this.cache.get(`payment:id:${id}`);
        if (!value) {
          throw new Error(`❌ Payment not found with id: ${id}`);
        }
        return value;
      },
    };
  }

  // Utility methods
  clear(): void {
    this.cache.clear();
  }

  private getKeysForNamespace(namespace: string): string[] {
    return Array.from(this.cache.keys())
      .filter((key) => key.startsWith(`${namespace}:`) && !key.includes(":id:"))
      .map((key) => key.replace(`${namespace}:`, ""));
  }

  getAllByNamespace<T>(namespace: string): T[] {
    return Array.from(this.cache.entries())
      .filter(([key]) => key.startsWith(`${namespace}:`) && !key.includes(":id:"))
      .map(([, value]) => value);
  }

  // Debug methods
  inspect(): {
    totalItems: number;
    namespaces: Record<string, number>;
    allKeys: string[];
  } {
    const allKeys = Array.from(this.cache.keys());
    const namespaces: Record<string, number> = {};

    for (const key of allKeys) {
      const namespace = key.split(":")[0];
      namespaces[namespace] = (namespaces[namespace] || 0) + 1;
    }

    return {
      totalItems: this.cache.size,
      namespaces,
      allKeys,
    };
  }

  dump(): Record<string, any> {
    const result: Record<string, any> = {};
    this.cache.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  size(): number {
    return this.cache.size;
  }
}
