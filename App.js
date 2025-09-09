import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import productRoutes from './routes/productRoutes.js'; 
import userRoutes from './routes/userRoutes.js'; 
import orderRoutes from './routes/orderRoutes.js';  
import categoryRoutes from './routes/categoryRoutes.js';  
import paymentRoutes from './routes/paymentRoutes.js';
import statisticRoutes from './routes/statisticRoutes.js';
import promotionRoutes from './routes/promotionRoutes.js';
import newsletterRoutes from './routes/newsletterRoutes.js';
import cacheRoutes from './routes/cacheRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import { notFound, errorHandler } from './middlewares/errorMiddleware.js';  
import { warmupCache } from './middlewares/cacheMiddleware.js';
import { cacheManager } from './utils/cacheManager.js';

dotenv.config();

const app = express();

// Configuration CORS optimisée
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL 
    : ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions)); 
app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware de métriques de performance
app.use((req, res, next) => {
  req.startTime = Date.now();
  
  // Intercepter la réponse pour mesurer le temps
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - req.startTime;
    
    // Log des requêtes lentes (> 1 seconde)
    if (duration > 1000) {
      console.log(`⚠️  Slow request: ${req.method} ${req.url} - ${duration}ms`);
    }
    
    // Ajouter des headers de performance
    res.set({
      'X-Response-Time': `${duration}ms`,
      'X-Cache-Status': res.get('X-Cache-Status') || 'MISS'
    });
    
    return originalSend.call(this, data);
  };
  
  next();
});

// Health check amélioré avec cache
app.get('/api/health', async (req, res) => {
  const healthCheck = {
    uptime: process.uptime(),
    message: 'API Fragrance de Mumu - Santé OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    cache: {
      memory: {
        status: 'OK',
        stats: memoryCache.getStats()
      },
      redis: {
        status: 'OK', 
        connected: false
      }
    }
  };

  try {
    // Test de connexion Redis
    const redisTest = await cacheManager.get('health:test');
    await cacheManager.set('health:test', 'OK', 30);
    healthCheck.cache.redis.connected = true;
    healthCheck.cache.redis.status = 'CONNECTED';
  } catch (error) {
    healthCheck.cache.redis.status = 'ERROR';
    healthCheck.cache.redis.error = error.message;
  }

  res.json(healthCheck);
});

app.get('/', (req, res) => {
  res.json({
    message: 'API Fragrance de Mumu est en cours d\'exécution...',
    version: '2.0.0',
    cache: 'Enabled',
    timestamp: new Date().toISOString()
  });
});

// Application des routes avec cache
app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/stats', statisticRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/cache', cacheRoutes); 
app.use('/api/contact', contactRoutes);

// Middleware de préchauffage du cache au démarrage
app.use('/api/warmup', warmupCache);

// Middleware pour les métriques de cache
app.use((req, res, next) => {
  if (req.method === 'GET') {
    // Ajouter des headers informatifs sur le cache
    res.set('X-Cache-Enabled', 'true');
    res.set('X-Cache-Strategy', 'L1(Memory)+L2(Redis)');
  }
  next();
});

// Middlewares pour gérer les erreurs 404 et autres erreurs
app.use(notFound);
app.use(errorHandler);

// Gestionnaire de fermeture gracieuse
process.on('SIGTERM', async () => {
  console.log('🛑 Arrêt du serveur en cours...');
  
  try {
    // Nettoyage du cache
    memoryCache.clear();
    
    // Fermeture des connexions Redis
    if (redis.status === 'ready') {
      await redis.quit();
    }
    
    console.log('✅ Arrêt propre du serveur terminé');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de l\'arrêt:', error);
    process.exit(1);
  }
});

// Gestionnaire d'erreurs non capturées
process.on('unhandledRejection', (err) => {
  console.error('🚨 Unhandled Promise Rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('🚨 Uncaught Exception:', err);
  process.exit(1);
});

export default app;