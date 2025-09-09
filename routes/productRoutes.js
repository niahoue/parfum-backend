// src/routes/productRoutes.js avec cache
import express from 'express';
import {
  getProducts,
  getProductById,
  deleteProduct,
  createProduct,
  updateProduct,
  createProductReview,
} from '../controllers/productController.js';
import { protect, admin } from '../middlewares/authMiddleware.js';
import {upload }from '../middlewares/uploadMiddleware.js';
import { cacheResponse, invalidateCache, keyGenerators } from '../middlewares/cacheMiddleware.js';

const router = express.Router();

// Routes GET avec cache
router.route('/')
  .get(
    cacheResponse('products', 1800, keyGenerators.productList), // Cache 30min
    getProducts
  )
  .post(
    protect,
    admin,
    upload.single('image'),
    invalidateCache(['products:list', 'stats']),
    createProduct
  );

router.route('/:id')
  .get(
    cacheResponse('products', 3600, keyGenerators.productById), // Cache 1h
    getProductById
  )
  .delete(
    protect,
    admin,
    invalidateCache([
      (req) => `products:single:${req.params.id}`,
      'products:list',
      'stats'
    ]),
    deleteProduct
  )
  .put(
    protect,
    admin,
    upload.single('image'),
    invalidateCache([
      (req) => `products:single:${req.params.id}`,
      'products:list',
      'stats'
    ]),
    updateProduct
  );

router.route('/:id/reviews')
  .post(
    protect,
    invalidateCache([
      (req) => `products:single:${req.params.id}`,
      'products:list'
    ]),
    createProductReview
  );

export default router;