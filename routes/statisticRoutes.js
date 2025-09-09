// routes/statisticRoutes.js
import express from 'express';
import { getDashboardStats } from '../controllers/statisticController.js';
import { protect, admin } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Route pour obtenir les statistiques du tableau de bord (Admin seulement)
router.route('/dashboard').get(protect, admin, getDashboardStats);

export default router;