import express from 'express';
import {
  addOrderItems,
  getOrderById,
  updateOrderToPaid,
  getMyOrders,
  getOrders,
  updateOrderToDelivered,
  deleteOrder
} from '../controllers/orderController.js';
import { protect, admin } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.route('/')
  .post(protect, addOrderItems) // Créer une nouvelle commande (utilisateur connecté)
  .get(protect, admin, getOrders); // Récupérer toutes les commandes (admin)

router.route('/myorders').get(protect, getMyOrders); // Récupérer les commandes de l'utilisateur

router.route('/:id')
  .get(protect, getOrderById)
  .delete(protect, admin, deleteOrder); // Supprimer une commande par ID (admin)

router.route('/:id/pay')
  .put(protect, updateOrderToPaid); // Mettre à jour le statut de paiement (utilisateur)

router.route('/:id/deliver')
  .put(protect, admin, updateOrderToDelivered); // Mettre à jour le statut de livraison (admin)

export default router;