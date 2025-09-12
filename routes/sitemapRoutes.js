// backend/routes/sitemapRoutes.js
import express from 'express';
import { generateSitemap } from '../controllers/sitemapController.js';

const router = express.Router();

// @desc    Generate and serve XML sitemap
// @route   GET /sitemap.xml
// @access  Public
router.get('/sitemap.xml', generateSitemap);

export default router;