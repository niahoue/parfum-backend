// src/middlewares/cacheMiddleware.js
import { cacheManager } from '../utils/cacheManager.js';

// Middleware pour mettre en cache les réponses GET
export const cacheResponse = (cacheType, ttl = null, keyGenerator = null) => {
  return async (req, res, next) => {
    // Ne cache que les requêtes GET
    if (req.method !== 'GET') {
      return next();
    }

    try {
      // Génère la clé de cache
      const cacheKey = keyGenerator 
        ? keyGenerator(req) 
        : cacheManager.generateKey(cacheType, req.originalUrl, req.query);

      // Tente de récupérer depuis le cache
      const cachedData = await cacheManager.get(cacheKey);
      
      if (cachedData) {
        return res.json(cachedData);
      }

      // Si pas en cache, intercepte la réponse
      const originalJson = res.json;
      res.json = function(data) {
        // Sauvegarde en cache seulement si succès (status 200-299)
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cacheManager.set(cacheKey, data, ttl).catch(err => 
            console.warn('Cache set error:', err.message)
          );
        }
        // Appelle la méthode json originale
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      console.warn('Cache middleware error:', error.message);
      next();
    }
  };
};

// Middleware pour invalider le cache après modification
export const invalidateCache = (patterns) => {
  return async (req, res, next) => {
    const originalJson = res.json;
    
    res.json = function(data) {
      // Invalide le cache seulement si l'opération a réussi
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const invalidationPromises = patterns.map(pattern => {
          if (typeof pattern === 'function') {
            pattern = pattern(req, data);
          }
          return cacheManager.invalidateByPattern(pattern);
        });
        
        Promise.all(invalidationPromises).catch(err => 
          console.warn('Cache invalidation error:', err.message)
        );
      }
      
      return originalJson.call(this, data);
    };
    
    next();
  };
};

// Générateurs de clés personnalisés
export const keyGenerators = {
  // Pour les listes de produits avec filtres
  productList: (req) => {
    const params = {
      page: req.query.pageNumber || 1,
      keyword: req.query.keyword || '',
      brand: req.query.brand || '',
      category: req.query.category || '',
      minPrice: req.query.minPrice || '',
      maxPrice: req.query.maxPrice || ''
    };
    return cacheManager.generateKey('products', 'list', params);
  },

  // Pour un produit individuel
  productById: (req) => {
    return cacheManager.generateKey('products', `single:${req.params.id}`);
  },

  // Pour les catégories
  categories: (req) => {
    return cacheManager.generateKey('categories', 'all');
  },

  // Pour les statistiques
  stats: (req) => {
    const period = req.query.period || 'month';
    return cacheManager.generateKey('stats', period);
  }
};

// Middleware de préchauffage du cache
export const warmupCache = async (req, res, next) => {
  try {
    // Logique de préchauffage personnalisée
    // Par exemple, précharger les catégories au démarrage
    console.log('🔥 Cache warmup initiated');
    next();
  } catch (error) {
    console.warn('Cache warmup error:', error.message);
    next();
  }
};