// src/utils/memoryCache.js - Version optimisée
class MemoryCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.ttl = new Map();
    this.timers = new Map(); // Pour gérer les timeouts
    this.maxSize = options.maxSize || 1000; // Limite de taille
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0
    };
  }

  set(key, value, ttlSeconds = 3600) {
    // Vérification de la taille limite
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this._evictLRU();
    }

    // Nettoyage du timer précédent si existant
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // Stockage de la valeur avec timestamp d'accès pour LRU
    this.cache.set(key, {
      value: value,
      accessTime: Date.now()
    });
    
    const expireTime = Date.now() + ttlSeconds * 1000;
    this.ttl.set(key, expireTime);

    // Définir le timer d'expiration
    const timer = setTimeout(() => {
      this.delete(key);
    }, ttlSeconds * 1000);
    
    this.timers.set(key, timer);
    this.stats.sets++;
    
    return true;
  }

  get(key) {
    // Vérification d'expiration
    if (this.ttl.has(key) && Date.now() > this.ttl.get(key)) {
      this.delete(key);
      this.stats.misses++;
      return null;
    }

    const item = this.cache.get(key);
    if (item) {
      // Mise à jour du temps d'accès pour LRU
      item.accessTime = Date.now();
      this.cache.set(key, item);
      this.stats.hits++;
      return item.value;
    }

    this.stats.misses++;
    return null;
  }

  has(key) {
    if (this.ttl.has(key) && Date.now() > this.ttl.get(key)) {
      this.delete(key);
      return false;
    }
    return this.cache.has(key);
  }

  delete(key) {
    const existed = this.cache.delete(key);
    this.ttl.delete(key);
    
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }

    if (existed) {
      this.stats.deletes++;
    }
    
    return existed;
  }

  clear() {
    // Nettoyage de tous les timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }

    const size = this.cache.size;
    this.cache.clear();
    this.ttl.clear();
    this.timers.clear();
    
    this.stats.deletes += size;
  }

  // Éviction LRU (Least Recently Used)
  _evictLRU() {
    let oldestKey = null;
    let oldestTime = Date.now();

    for (const [key, item] of this.cache) {
      if (item.accessTime < oldestTime) {
        oldestTime = item.accessTime;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
      this.stats.evictions++;
      console.log(`🗑️ Cache LRU eviction: ${oldestKey}`);
    }
  }

  // Nettoyage des entrées expirées
  cleanup() {
    const now = Date.now();
    const keysToDelete = [];

    for (const [key, expireTime] of this.ttl) {
      if (now > expireTime) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.delete(key));
    return keysToDelete.length;
  }

  // Statistiques du cache
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0;

    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      size: this.cache.size,
      maxSize: this.maxSize,
      memoryUsage: this._estimateMemoryUsage()
    };
  }

  // Estimation de l'utilisation mémoire
  _estimateMemoryUsage() {
    let totalSize = 0;
    
    for (const [key, item] of this.cache) {
      // Estimation approximative
      totalSize += key.length * 2; // String UTF-16
      totalSize += JSON.stringify(item.value).length * 2;
      totalSize += 32; // Overhead pour les métadonnées
    }
    
    return {
      bytes: totalSize,
      kb: (totalSize / 1024).toFixed(2),
      mb: (totalSize / 1024 / 1024).toFixed(2)
    };
  }

  // Récupération de toutes les clés (avec filtrage optionnel)
  keys(pattern = null) {
    const allKeys = Array.from(this.cache.keys());
    
    if (pattern) {
      return allKeys.filter(key => key.includes(pattern));
    }
    
    return allKeys;
  }

  // Récupération de toutes les valeurs
  values() {
    return Array.from(this.cache.values()).map(item => item.value);
  }

  // Récupération de toutes les entrées
  entries() {
    const result = [];
    for (const [key, item] of this.cache) {
      result.push([key, item.value]);
    }
    return result;
  }

  // Définition de la taille maximale
  setMaxSize(newMaxSize) {
    this.maxSize = newMaxSize;
    
    // Éviction si nécessaire
    while (this.cache.size > this.maxSize) {
      this._evictLRU();
    }
  }
}

// Cache global avec nettoyage automatique
export const memoryCache = new MemoryCache({
  maxSize: 1000 // Limite à 1000 entrées
});

// Nettoyage automatique toutes les 5 minutes
setInterval(() => {
  const cleanedCount = memoryCache.cleanup();
  if (cleanedCount > 0) {
    console.log(`🧹 Cache cleanup: ${cleanedCount} entrées expirées supprimées`);
  }
}, 5 * 60 * 1000);

// Affichage des stats toutes les heures en mode développement
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    const stats = memoryCache.getStats();
    console.log('📊 Cache Memory Stats:', stats);
  }, 60 * 60 * 1000);
}