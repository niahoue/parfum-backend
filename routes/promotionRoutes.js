// backend/routes/promotionRoutes.js
import express from 'express';
import {
  getActivePromotion,
  createPromotion,
  getPromotions,
  getPromotionById,
  updatePromotion,
  deletePromotion,
  togglePromotion, // Assurez-vous d'importer togglePromotion
  applyPromotionCode, // Nouvelle fonction importée pour appliquer un code promotionnel
} from '../controllers/promotionController.js';
import { protect, admin } from '../middlewares/authMiddleware.js'; // Assurez-vous que le chemin est correct

const router = express.Router();

// Route publique pour obtenir la promotion active (pour la page d'accueil)
router.route('/active').get(getActivePromotion);

// Route pour appliquer un code promotionnel
// Accès privé : l'utilisateur doit être connecté pour appliquer un code promotionnel à son panier.
router.route('/apply').post(protect, applyPromotionCode);

// Routes privées/admin pour la gestion CRUD des promotions
router.route('/')
  .post(protect, admin, createPromotion) // Créer une promotion (Admin)
  .get(protect, admin, getPromotions);   // Obtenir toutes les promotions (Admin)

router.route('/:id')
  .get(protect, admin, getPromotionById)  // Obtenir une promotion par ID (Admin)
  .put(protect, admin, updatePromotion)   // Mettre à jour une promotion (Admin)
  .delete(protect, admin, deletePromotion); // Supprimer une promotion (Admin)
  
// Route pour activer/désactiver une promotion
// Accès privé/Admin : seul un administrateur peut changer le statut d'activité d'une promotion.
router.route('/:id/toggle').patch(protect, admin, togglePromotion);

export default router;
