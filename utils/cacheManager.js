// src/utils/cacheManager.js
import redis from '../config/redisClient.js';
import { memoryCache } from './memoryCahe.js';

class CacheManager {
  constructor() {
    this.defaultTTL = {
      products: 3600, // 1 heure pour les produits
      categories: 7200, // 2 heures pour les catégories
      stats: 900, // 15 minutes pour les statistiques
      user: 1800, // 30 minutes pour les données utilisateur
      search: 600, // 10 minutes pour les recherches
    };
    
    this.memoryTTL = {
      products: 300, // 5 minutes en mémoire
      categories: 600, // 10 minutes en mémoire
      stats: 180, // 3 minutes en mémoire
      user: 300, // 5 minutes en mémoire
      search: 120, // 2 minutes en mémoire
    };
  }

  // Génère une clé de cache cohérente
  generateKey(type, identifier, params = {}) {
    const baseKey = `${type}:${identifier}`;
    if (Object.keys(params).length === 0) return baseKey;
    
    // Trier les paramètres pour une cohérence de clé
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join('|');
    
    return `${baseKey}:${sortedParams}`;
  }

  // Récupère les données avec stratégie L1 (mémoire) -> L2 (Redis)
  async get(key) {
    try {
      // Niveau 1: Cache mémoire
      const memoryData = memoryCache.get(key);
      if (memoryData) {
        console.log(`✅ Cache HIT (Memory): ${key}`);
        return JSON.parse(memoryData);
      }

      // Niveau 2: Redis
      const redisData = await redis.safeGet(key);
      if (redisData) {
        console.log(`✅ Cache HIT (Redis): ${key}`);
        const parsedData = JSON.parse(redisData);
        
        // Remettre en cache mémoire avec TTL plus court
        const cacheType = key.split(':')[0];
        const memoryTTL = this.memoryTTL[cacheType] || 300;
        memoryCache.set(key, redisData, memoryTTL);
        
        return parsedData;
      }

      console.log(`❌ Cache MISS: ${key}`);
      return null;
    } catch (error) {
      console.warn(`Cache GET error for ${key}:`, error.message);
      return null;
    }
  }

  // Stocke les données dans les deux niveaux de cache
  async set(key, data, customTTL = null) {
    try {
      const jsonData = JSON.stringify(data);
      const cacheType = key.split(':')[0];
      const redisTTL = customTTL || this.defaultTTL[cacheType] || 3600;
      const memoryTTL = this.memoryTTL[cacheType] || 300;

      // Stocker dans Redis
      await redis.safeSet(key, jsonData, 'EX', redisTTL);
      
      // Stocker dans le cache mémoire
      memoryCache.set(key, jsonData, memoryTTL);
      
      console.log(`💾 Cache SET: ${key} (Redis: ${redisTTL}s, Memory: ${memoryTTL}s)`);
      return true;
    } catch (error) {
      console.warn(`Cache SET error for ${key}:`, error.message);
      return false;
    }
  }

  // Invalide le cache pour une clé spécifique
  async invalidate(key) {
    try {
      await redis.del(key);
      memoryCache.delete(key);
      console.log(`🗑️  Cache INVALIDATED: ${key}`);
    } catch (error) {
      console.warn(`Cache invalidation error for ${key}:`, error.message);
    }
  }

  // Invalide tous les caches d'un type donné
  async invalidateByPattern(pattern) {
    try {
      // Pour Redis
      const keys = await redis.keys(`${pattern}*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      
      // Pour le cache mémoire
      for (const [key] of memoryCache.cache) {
        if (key.startsWith(pattern)) {
          memoryCache.delete(key);
        }
      }
      
      console.log(`🗑️  Cache PATTERN INVALIDATED: ${pattern}* (${keys.length} keys)`);
    } catch (error) {
      console.warn(`Cache pattern invalidation error for ${pattern}:`, error.message);
    }
  }

  // Réchauffe le cache avec des données fréquemment utilisées
  async warmup(type, data) {
    const key = this.generateKey(type, 'warmup');
    await this.set(key, data);
  }

  // Obtient les statistiques du cache
  async getStats() {
    try {
      const redisInfo = await redis.info('memory');
      const memoryStats = {
        size: memoryCache.cache.size,
        keys: Array.from(memoryCache.cache.keys())
      };
      
      return {
        redis: redisInfo,
        memory: memoryStats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.warn('Error getting cache stats:', error.message);
      return null;
    }
  }
}

export const cacheManager = new CacheManager();