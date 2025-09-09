import express from 'express';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../controllers/categoryController.js';
import { protect, admin } from '../middlewares/authMiddleware.js';
import { cacheResponse, invalidateCache, keyGenerators } from '../middlewares/cacheMiddleware.js';

const router = express.Router();

// Route publique pour récupérer toutes les catégories
router.route('/').get(cacheResponse('categories', 7200, keyGenerators.categories), getCategories);

// Routes privées pour les administrateurs
router.route('/').post(protect, admin, invalidateCache(['categories']),createCategory);
router.route('/:id')
.put(protect, admin, invalidateCache(['categories', 'products:list']),updateCategory)
.delete(protect, admin,invalidateCache(['categories', 'products:list']), deleteCategory);

export default router;