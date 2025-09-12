import asyncHandler from 'express-async-handler';
import User from '../models/User.js';
import Product from '../models/Product.js';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { sendResetPasswordEmail } from '../utils/emailService.js';
import generateToken from '../utils/generateToken.js';

// @desc    Auth user & get token
// @route   POST /api/users/login
// @access  Public
const authUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');
  if (user && (await user.matchPassword(password))) {
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role, 
      isAdmin: user.role === 'admin', 
      token: generateToken(user._id),
    });
  } else {
    res.status(401);
    throw new Error('Email ou mot de passe invalide');
  }
});

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isAdmin: user.role === 'admin',
      favorites: user.favorites || [],
      address: user.address, // AJOUTÉ
      city: user.city,       // AJOUTÉ
      country: user.country, // AJOUTÉ
      phone: user.phone,     // AJOUTÉ
    });
  } else {
    res.status(404);
    throw new Error('Utilisateur non trouvé');
  }
});

// @desc    Register a new user
// @route   POST /api/users
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
  // AJOUT des nouveaux champs pour la déstructuration
  const { name, email, password, role = 'user', address, city, country, phone } = req.body; 

  const userExists = await User.findOne({ email });

  if (userExists) {
    res.status(400);
    throw new Error('Cet utilisateur existe déjà');
  }

  const user = await User.create({
    name,
    email,
    password,
    role,
    address, // AJOUTÉ
    city,    // AJOUTÉ
    country, // AJOUTÉ
    phone,   // AJOUTÉ
  });

  if (user) {
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isAdmin: user.role === 'admin',
      token: generateToken(user._id),
      address: user.address, // AJOUTÉ pour la réponse après inscription
      city: user.city,
      country: user.country,
      phone: user.phone,
    });
  } else {
    res.status(400);
    throw new Error('Données utilisateur non valides');
  }
});

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    user.address = req.body.address !== undefined ? req.body.address : user.address;   // AJOUTÉ
    user.city = req.body.city !== undefined ? req.body.city : user.city;             // AJOUTÉ
    user.country = req.body.country !== undefined ? req.body.country : user.country; // AJOUTÉ
    user.phone = req.body.phone !== undefined ? req.body.phone : user.phone;         // AJOUTÉ

    if (req.body.role && ['user', 'admin'].includes(req.body.role)) {
      user.role = req.body.role;
    }
    if (req.body.password) {
      user.password = req.body.password;
    }

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      isAdmin: updatedUser.role === 'admin',
      token: generateToken(updatedUser._id),
      address: updatedUser.address, // AJOUTÉ à la réponse
      city: updatedUser.city,
      country: updatedUser.country,
      phone: updatedUser.phone,
    });
  } else {
    res.status(404);
    throw new Error('Utilisateur non trouvé');
  }
});

// @desc    Forgot password
// @route   POST /api/users/forgotpassword
// @access  Public
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });

  if (!user) {

    res.status(404);
    throw new Error('Utilisateur non trouvé avec cet email');
  }

  // Générer le token de réinitialisation
  const resetToken = user.getResetPasswordToken();

  try {
    await user.save({ validateBeforeSave: false });
  } catch (error) {
    res.status(500);
    throw new Error('Erreur lors de la génération du token de réinitialisation');
  }

  // Créer l'URL de réinitialisation
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');

  // Pour le développement, utilisez une URL frontend
  const baseUrl = process.env.NODE_ENV === 'production'
    ? `${protocol}://${host}`
    : process.env.FRONTEND_URL || 'http://localhost:3000';

  const resetUrl = `${baseUrl}/reset-password/${resetToken}`;

  try {
  
    const emailResult = await sendResetPasswordEmail(user, resetUrl);
    res.status(200).json({
      success: true,
      message: 'Email de réinitialisation envoyé avec succès',
      data: {
        email: user.email,
        messageId: emailResult.messageId
      }
    });

  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    try {
      await user.save({ validateBeforeSave: false });
    } catch (saveError) {
      console.error('❌ Erreur lors du nettoyage du token:', saveError);
    }

    res.status(500);
    throw new Error(`Impossible d'envoyer l'email de réinitialisation: ${error.message}`);
  }
});

// @desc    Reset password
// @route   PUT /api/users/resetpassword/:token
// @access  Public
const resetPassword = asyncHandler(async (req, res) => {
  const { password } = req.body;
  const { token } = req.params;


  const resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');

  // Recherche de l'utilisateur avec le token et une date d'expiration valide
  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  }).select('+password'); 

  if (!user) {
  
    res.status(400);
    throw new Error('Token invalide ou expiré');
  }

  // Vérification de la longueur du mot de passe côté serveur pour plus de sécurité
  if (password.length < 6) {
    res.status(400);
    throw new Error('Le mot de passe doit contenir au moins 6 caractères');
  }
  
  // ⚠️ CORRECTION: Ne pas hacher manuellement le mot de passe
  // Laissez le middleware pre('save') s'en charger
  user.password = password; // Assigner directement le mot de passe en clair

  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;

  try {
    await user.save();
    res.status(200).json({
      success: true,
      message: 'Mot de passe mis à jour avec succès',
      data: {
        email: user.email
      }
    });
  } catch (saveError) {
    res.status(500);
    throw new Error('Erreur interne du serveur lors de la mise à jour du mot de passe');
  }
});

// @desc    Add a product to wishlist
// @route   POST /api/users/wishlist
// @access  Private
const addToWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.body;
  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error('Utilisateur non trouvé');
  }

  const product = await Product.findById(productId);
  if (!product) {
    res.status(404);
    throw new Error('Produit non trouvé');
  }

  // Vérifier si le produit est déjà dans la wishlist
  if (user.favorites.includes(productId)) {
    res.status(400);
    throw new Error('Le produit est déjà dans la liste de souhaits');
  }

  user.favorites.push(productId);
  await user.save();
  res.status(200).json({ message: 'Produit ajouté à la liste de souhaits', wishlist: user.favorites });
});

// @desc    Remove a product from wishlist
// @route   DELETE /api/users/wishlist/:id
// @access  Private
const removeFromWishlist = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error('Utilisateur non trouvé');
  }

  // Vérifier si le produit est dans la wishlist
  if (!user.favorites.includes(id)) {
    res.status(404);
    throw new Error('Produit non trouvé dans la liste de souhaits');
  }

  user.favorites.pull(id);
  await user.save();
  res.status(200).json({ message: 'Produit retiré de la liste de souhaits', wishlist: user.favorites });
});

/**
 * @desc    Récupérer le panier de l'utilisateur connecté
 * @route   GET /api/users/cart
 * @access  Privé
 */
const getUserCart = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate('cart.product'); // Populer les détails du produit
  if (user) {
    // Transformer les éléments du panier pour inclure les détails du produit
    const cartItems = user.cart.map(item => ({
      _id: item.product._id, // ID du produit
      name: item.product.name,
      imageUrl: item.product.imageUrl,
      price: item.product.price,
      brand: item.product.brand,
      countInStock: item.product.countInStock,
      qty: item.qty,
    }));
    res.json({ cartItems });
  } else {
    res.status(404);
    throw new Error('Utilisateur non trouvé');
  }
});

/**
 * @desc    Ajouter un produit au panier de l'utilisateur
 * @route   POST /api/users/cart/add
 * @access  Privé
 */
const addProductToCart = asyncHandler(async (req, res) => {
  const { productId, qty } = req.body;
  const user = await User.findById(req.user._id);
  const product = await Product.findById(productId);

  if (!user || !product) {
    res.status(404);
    throw new Error('Utilisateur ou produit non trouvé');
  }

  if (product.countInStock < qty) {
    res.status(400);
    throw new Error('Quantité demandée supérieure au stock disponible');
  }

  const existingCartItemIndex = user.cart.findIndex(item => item.product.toString() === productId);

  if (existingCartItemIndex > -1) {
    // Mettre à jour la quantité si l'article existe déjà
    user.cart[existingCartItemIndex].qty += qty;
  } else {
    // Ajouter un nouvel article
    user.cart.push({ product: productId, qty });
  }

  await user.save();
  // Récupérer le panier mis à jour avec les détails des produits pour la réponse
  const updatedUser = await User.findById(req.user._id).populate('cart.product');
  const cartItems = updatedUser.cart.map(item => ({
    _id: item.product._id,
    name: item.product.name,
    imageUrl: item.product.imageUrl,
    price: item.product.price,
    brand: item.product.brand,
    countInStock: item.product.countInStock,
    qty: item.qty,
  }));
  res.status(200).json({ message: 'Produit ajouté au panier', cartItems });
});

/**
 * @desc    Mettre à jour la quantité d'un produit dans le panier
 * @route   PUT /api/users/cart/update
 * @access  Privé
 */
const updateProductInCart = asyncHandler(async (req, res) => {
  const { productId, qty } = req.body;
  const user = await User.findById(req.user._id);
  const product = await Product.findById(productId);

  if (!user || !product) {
    res.status(404);
    throw new Error('Utilisateur ou produit non trouvé');
  }

  if (product.countInStock < qty) {
    res.status(400);
    throw new Error('Quantité demandée supérieure au stock disponible');
  }

  const existingCartItemIndex = user.cart.findIndex(item => item.product.toString() === productId);

  if (existingCartItemIndex > -1) {
    user.cart[existingCartItemIndex].qty = qty;
    await user.save();
    const updatedUser = await User.findById(req.user._id).populate('cart.product');
    const cartItems = updatedUser.cart.map(item => ({
      _id: item.product._id,
      name: item.product.name,
      imageUrl: item.product.imageUrl,
      price: item.product.price,
      brand: item.product.brand,
      countInStock: item.product.countInStock,
      qty: item.qty,
    }));
    res.status(200).json({ message: 'Quantité du panier mise à jour', cartItems });
  } else {
    res.status(404);
    throw new Error('Produit non trouvé dans le panier');
  }
});

/**
 * @desc    Retirer un produit du panier de l'utilisateur
 * @route   DELETE /api/users/cart/remove/:productId
 * @access  Privé
 */
const removeProductFromCart = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const user = await User.findById(req.user._id);
  if (!user) {
    res.status(404);
    throw new Error('Utilisateur non trouvé');
  }

  const initialLength = user.cart.length;
  user.cart = user.cart.filter(item => {
    const match = item.product.toString() !== productId;
    return match;
  });

  if (user.cart.length === initialLength) {
    res.status(404);
    throw new Error(`Produit ${productId} non trouvé dans le panier`);
  }

  await user.save();
  
  const updatedUser = await User.findById(req.user._id).populate('cart.product');
  const cartItems = updatedUser.cart.map(item => ({
    _id: item.product._id,
    name: item.product.name,
    imageUrl: item.product.imageUrl,
    price: item.product.price,
    brand: item.product.brand,
    countInStock: item.product.countInStock,
    qty: item.qty,
  }));

  res.status(200).json({ message: 'Produit retiré du panier', cartItems });
});

/**
 * @desc    Vider entièrement le panier de l'utilisateur
 * @route   POST /api/users/cart/clear
 * @access  Privé
 */
const clearUserCart = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    res.status(404);
    throw new Error('Utilisateur non trouvé');
  }

  user.cart = []; // Vider le tableau du panier
  await user.save();
  res.status(200).json({ message: 'Panier vidé avec succès', cartItems: [] });
});
const getUser = asyncHandler (async (req,res)=>{
  const user = await User.findById(req.user._id).select('-password');
  if (user) {
    res.json(user);
  } else {
    res.status(404);
    throw new Error('Utilisateur non trouvé');
  }
});

const getAllUser = asyncHandler(async(req,res)=> {
  const users = await User.find().select('-password');
  res.json(users);
});

const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (user) {
    await user.deleteOne();
    res.json({ message: 'Utilisateur supprimé avec succès' });
  } else {
    res.status(404);
    throw new Error('Utilisateur non trouvé');
  }
});

// @desc    Update user by ID
// @route   PUT /api/users/:id
// @access  Private/Admin
const updateUserRole = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (user) {
    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    user.role = req.body.role || user.role; // Permettre la mise à jour du rôle
    // Autres champs...

    const updatedUser = await user.save();
    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      isAdmin: updatedUser.role === 'admin'
    });
  } else {
    res.status(404);
    throw new Error('Utilisateur non trouvé');
  }
});


export {
  authUser,
  registerUser,
  getUserProfile,
  updateUserProfile,
  updateUserRole,
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
  deleteUser
};
