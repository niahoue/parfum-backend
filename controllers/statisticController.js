// controllers/statisticController.js
import asyncHandler from 'express-async-handler';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';

/**
 * @desc    Obtenir les statistiques du tableau de bord (nombre d'utilisateurs, produits, commandes, revenus)
 * @route   GET /api/stats/dashboard
 * @access  Private/Admin
 */
export const getDashboardStats = asyncHandler(async (req, res) => {
  // Nombre total d'utilisateurs
  const usersCount = await User.countDocuments({});

  // Nombre total de produits
  const productsCount = await Product.countDocuments({});

  // Nombre total de commandes
  const ordersCount = await Order.countDocuments({});

  // Revenu total (somme de totalPrice de toutes les commandes payées)
  const totalRevenue = await Order.aggregate([
    {
      $match: { isPaid: true }, // Filtrer uniquement les commandes payées
    },
    {
      $group: {
        _id: null, // Grouper tous les documents en un seul
        total: { $sum: '$totalPrice' }, // Somme des totalPrice
      },
    },
  ]);

  // Commandes récentes (limitées à 5 ou 10, pour un aperçu rapide)
  const recentOrders = await Order.find({})
    .sort({ createdAt: -1 }) 
    .limit(10)
    .populate('user', 'name email');

  res.json({
    usersCount,
    productsCount,
    ordersCount,
    totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0, 
    recentOrders,
  });
});
