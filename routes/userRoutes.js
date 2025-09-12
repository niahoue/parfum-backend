import express from 'express';
import {
  authUser,
  registerUser,
  getUserProfile,
  updateUserProfile,
  forgotPassword,
  resetPassword,
  addToWishlist,
  removeFromWishlist,
  getUserCart,
  addProductToCart,
  updateProductInCart,
  removeProductFromCart,
  clearUserCart,
  getUser,
  getAllUser, 
  deleteUser,
  updateUserRole
} from '../controllers/userController.js';
import { protect ,admin} from '../middlewares/authMiddleware.js';

const router = express.Router();

// Routes publiques
router.post('/register', registerUser);
router.post('/login', authUser);
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword/:token', resetPassword);

// Routes protégées par l'authentification (pour tous les utilisateurs connectés)
router.route('/profile').get(protect, getUserProfile).put(protect, updateUserProfile);
router.route('/wishlist').post(protect, addToWishlist);
router.route('/wishlist/:id').delete(protect, removeFromWishlist);

// Routes pour la gestion du panier (accessibles à tout utilisateur connecté)
router.route('/cart')
  .get(protect, getUserCart) // Récupérer le panier
  .post(protect, addProductToCart); // Ajouter au panier

router.route('/cart/add').post(protect, addProductToCart); // Route pour ajouter un article (plus spécifique)
router.route('/cart/update').put(protect, updateProductInCart); // Route pour mettre à jour la quantité
router.route('/cart/remove/:productId').delete(protect, removeProductFromCart); // Route pour retirer un article
router.route('/cart/clear').post(protect, clearUserCart); // Route pour vider le panier

// Routes protégées par l'authentification et le rôle administrateur
router.route('/').get(protect, admin, getAllUser); // Récupérer tous les utilisateurs (Admin)
router.route('/:id').get(protect, admin, getUser); // Récupérer un utilisateur par ID (Admin)
router.route('/:id').delete(protect, admin, deleteUser);
router.route('/:id').put(protect, admin, updateUserRole); // Mettre à jour un utilisateur par ID (Admin)

export default router;