// src/routes/cacheRoutes.js
import express from 'express';
import { cacheManager } from '../utils/cacheManager.js';
import { protect, admin } from '../middlewares/authMiddleware.js';
import asyncHandler from 'express-async-handler';

const router = express.Router();

// @desc    Obtenir les statistiques du cache
// @route   GET /api/cache/stats
// @access  Private/Admin
const getCacheStats = asyncHandler(async (req, res) => {
  const stats = await cacheManager.getStats();
  res.json({
    success: true,
    data: stats,
    timestamp: new Date().toISOString()
  });
});

// @desc    Vider tout le cache
// @route   DELETE /api/cache/clear
// @access  Private/Admin
const clearAllCache = asyncHandler(async (req, res) => {
  await Promise.all([
    cacheManager.invalidateByPattern('products'),
    cacheManager.invalidateByPattern('categories'),
    cacheManager.invalidateByPattern('stats'),
    cacheManager.invalidateByPattern('users')
  ]);
  
  res.json({
    success: true,
    message: 'Cache entièrement vidé'
  });
});

// @desc    Vider le cache par type
// @route   DELETE /api/cache/clear/:type
// @access  Private/Admin
const clearCacheByType = asyncHandler(async (req, res) => {
  const { type } = req.params;
  const validTypes = ['products', 'categories', 'stats', 'users'];
  
  if (!validTypes.includes(type)) {
    res.status(400);
    throw new Error(`Type de cache invalide. Types valides: ${validTypes.join(', ')}`);
  }
  
  await cacheManager.invalidateByPattern(type);
  
  res.json({
    success: true,
    message: `Cache '${type}' vidé avec succès`
  });
});

// @desc    Préchauffer le cache avec les données populaires
// @route   POST /api/cache/warmup
// @access  Private/Admin
const warmupCache = asyncHandler(async (req, res) => {
  // Importer dynamiquement les modèles pour éviter les dépendances circulaires
  const Product = (await import('../models/Product.js')).default;
  const Category = (await import('../models/Category.js')).default;
  
  try {
    // Précharger les produits les plus populaires
    const popularProducts = await Product.find()
      .sort({ rating: -1, numReviews: -1 })
      .limit(20)
      .populate('category', 'name')
      .lean();
    
    // Précharger toutes les catégories
    const categories = await Category.find().lean();
    
    // Précharger les produits les plus récents
    const recentProducts = await Product.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('category', 'name')
      .lean();
    
    // Précharger les best sellers
    const bestSellers = await Product.find({ isBestSeller: true })
      .populate('category', 'name')
      .lean();
    
    // Mise en cache des données
    const warmupPromises = [
      // Cache des catégories
      cacheManager.set(cacheManager.generateKey('categories', 'all'), categories, 7200),
      
      // Cache des produits populaires individuellement
      ...popularProducts.map(product => 
        cacheManager.set(
          cacheManager.generateKey('products', `single:${product._id}`), 
          product, 
          3600
        )
      ),
      
      // Cache des listes spéciales
      cacheManager.set(cacheManager.generateKey('products', 'popular'), popularProducts, 1800),
      cacheManager.set(cacheManager.generateKey('products', 'recent'), recentProducts, 1800),
      cacheManager.set(cacheManager.generateKey('products', 'bestsellers'), bestSellers, 3600),
    ];
    
    await Promise.all(warmupPromises);
    
    res.json({
      success: true,
      message: 'Cache préchauffé avec succès',
      data: {
        popularProducts: popularProducts.length,
        categories: categories.length,
        recentProducts: recentProducts.length,
        bestSellers: bestSellers.length
      }
    });
    
  } catch (error) {
    console.error('Erreur lors du préchauffage du cache:', error);
    res.status(500);
    throw new Error('Erreur lors du préchauffage du cache');
  }
});

// @desc    Invalider le cache d'un produit spécifique
// @route   DELETE /api/cache/product/:id
// @access  Private/Admin
const invalidateProductCache = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  await Promise.all([
    cacheManager.invalidate(cacheManager.generateKey('products', `single:${id}`)),
    cacheManager.invalidateByPattern('products:list') // Invalide toutes les listes
  ]);
  
  res.json({
    success: true,
    message: `Cache du produit ${id} invalidé`
  });
});

const getCacheKeys = asyncHandler(async (req, res) => {
  const { pattern } = req.query;
  try {
    const keys = await cacheManager.keys(pattern);
    res.json({
      success: true,
      data: keys,
    });
  } catch (error) {
    
    throw new Error('Erreur lors de la récupération des clés de cache');
  }
});

// Application des routes
router.get('/stats', protect, admin, getCacheStats);
router.delete('/clear', protect, admin, clearAllCache);
router.delete('/clear/:type', protect, admin, clearCacheByType);
router.post('/warmup', protect, admin, warmupCache);
router.delete('/product/:id', protect, admin, invalidateProductCache);
router.get('/keys', protect, admin, getCacheKeys);

export default router;