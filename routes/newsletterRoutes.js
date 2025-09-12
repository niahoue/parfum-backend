// backend/routes/newsletterRoutes.js
import express from 'express';
import {
  subscribeToNewsletter,
  unsubscribeFromNewsletter,
  getAllSubscribers,
  deleteSubscriber,
  updateSubscriber,
} from '../controllers/newsletterController.js';
import { protect, admin } from '../middlewares/authMiddleware.js'; // Assurez-vous que le chemin est correct

const router = express.Router();

// Route publique pour l'abonnement à la newsletter
router.post('/subscribe', subscribeToNewsletter);

// Route publique pour la désinscription (un lien de désinscription unique serait mieux en prod)
router.post('/unsubscribe', unsubscribeFromNewsletter);

// Routes privées/admin pour la gestion des abonnés
router.route('/subscribers')
  .get(protect, admin, getAllSubscribers); 
router.route('/subscribers/:id')
  .delete(protect, admin, deleteSubscriber); 
router.route('/subscribers/:id')
  .put(protect, admin, updateSubscriber); 

export default router;
