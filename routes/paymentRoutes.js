import express from 'express';
import { createPayment, handlePaydunyaCallback
    ,handlePaydunyaWebhook,verifyPaymentStatus, findOrderByToken} from '../controllers/paymentController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

// @route   POST /api/payment/create
// @desc    Crée une facture de paiement avec PayDunya
// @access  Privé
router.post('/create', protect, createPayment);

// @route   GET /api/payment/callback
// @desc    Gère la redirection de PayDunya après le paiement
// @access  Public
router.get('/callback', handlePaydunyaCallback);

// Route pour le webhook de PayDunya (appelé par les serveurs de PayDunya)
router.post('/webhook', handlePaydunyaWebhook);

// @route   POST /api/payment/verify/:orderId
// @desc    Vérifie le statut d'une commande via PayDunya après un paiement (appelé par le frontend)
// @access  Privé (utilisateur connecté ou admin)
router.post('/verify/:orderId', protect, verifyPaymentStatus); // Nouvelle route ajoutée
// NOUVELLE ROUTE: Recherche de commande par token
router.get('/find-order/:token', findOrderByToken);


export default router;