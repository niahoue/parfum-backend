// backend/controllers/sitemapController.js
import asyncHandler from 'express-async-handler';
import { SitemapStream, streamToPromise } from 'sitemap';
import { createGzip } from 'zlib';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import { getImageUrl } from '../utils/imageUtils.js'; 

let sitemap; // Pour mettre en cache le sitemap généré

const generateSitemap = asyncHandler(async (req, res) => {
  res.header('Content-Type', 'application/xml');
  res.header('Content-Encoding', 'gzip');

  // Si le sitemap est déjà en cache, le renvoyer
  if (sitemap) {
    res.send(sitemap);
    return;
  }

  try {
    const sitemapStream = new SitemapStream({ hostname: 'https://www.fragrancedemumu.com' });
    const pipeline = sitemapStream.pipe(createGzip());

    // Pages statiques
    const staticPages = [
      { url: '/', changefreq: 'daily', priority: 1.0 },
      { url: '/products', changefreq: 'daily', priority: 0.9 },
      { url: '/promotions', changefreq: 'weekly', priority: 0.8 },
      { url: '/nouveautes', changefreq: 'weekly', priority: 0.8 },
      { url: '/marques', changefreq: 'weekly', priority: 0.7 },
      { url: '/cosmetiques', changefreq: 'weekly', priority: 0.7 },
      { url: '/a-propos', changefreq: 'monthly', priority: 0.6 },
      { url: '/contact', changefreq: 'monthly', priority: 0.7 },
      { url: '/faq', changefreq: 'monthly', priority: 0.5 },
      { url: '/livraison-retours', changefreq: 'monthly', priority: 0.5 },
      { url: '/cgv', changefreq: 'monthly', priority: 0.5 },
      { url: '/politique-confidentialite', changefreq: 'monthly', priority: 0.5 },
      { url: '/mentions-legales', changefreq: 'monthly', priority: 0.4 },
      // Ajoutez d'autres pages statiques ici
    ];
    staticPages.forEach(page => sitemapStream.write(page));

    // Pages de produits
    const products = await Product.find({}, '_id updatedAt imageUrl');
    products.forEach(product => {
      sitemapStream.write({
        url: `/products/${product._id}`,
        changefreq: 'weekly',
        priority: 0.8,
        lastmod: product.updatedAt,
        img: [{ url: getImageUrl(product.imageUrl) }]
      });
    });
    
    // Pages de catégories (basées sur les noms)
    const categories = await Category.find({}, 'name updatedAt');
    categories.forEach(category => {
      sitemapStream.write({
        url: `/products?category=${category._id}`,
        changefreq: 'weekly',
        priority: 0.7,
        lastmod: category.updatedAt
      });
    });

    sitemapStream.end();

    // Cache le sitemap pour les prochaines requêtes
    const generatedSitemap = await streamToPromise(pipeline);
    sitemap = generatedSitemap;
    
    res.send(sitemap);
  } catch (error) {
    console.error('Erreur lors de la génération du sitemap:', error);
    res.status(500).end();
  }
});

export { generateSitemap };