// backend/controllers/promotionController.js
import asyncHandler from 'express-async-handler';
import Promotion from '../models/Promotion.js';

/**
 * @desc    Obtenir la promotion active actuelle
 * @route   GET /api/promotions/active
 * @access  Public
 */
const getActivePromotion = asyncHandler(async (req, res) => {
  const now = new Date();

  try {
    const activePromotion = await Promotion.findOne({
      startDate: { $lte: now },
      endDate: { $gte: now },
      isActive: true,
    }).sort({ createdAt: -1 });

    if (activePromotion) {
      res.json({
        _id: activePromotion._id,
        message: activePromotion.message,
        code: activePromotion.code,
        discountType: activePromotion.discountType,
        discountValue: activePromotion.discountValue,
        minAmount: activePromotion.minAmount,
        startDate: activePromotion.startDate,
        endDate: activePromotion.endDate,
        isActive: true,
        createdAt: activePromotion.createdAt,
        updatedAt: activePromotion.updatedAt
      });
    } else {
      res.status(200).json({
        message: 'Aucune promotion active pour le moment.',
        isActive: false
      });
    }
  } catch (error) {
    console.error('Erreur lors de la récupération de la promotion active:', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération de la promotion',
      isActive: false,
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne'
    });
  }
});

/**
 * @desc    Créer une nouvelle promotion
 * @route   POST /api/promotions
 * @access  Private/Admin
 */
const createPromotion = asyncHandler(async (req, res) => {
  const { message, code, discountType, discountValue, minAmount, startDate, endDate } = req.body;

  if (!message || !code || !discountType || discountValue === undefined || !startDate || !endDate) {
    res.status(400);
    throw new Error('Tous les champs (message, code, type de réduction, valeur de réduction, date de début, date de fin) sont requis.');
  }

  const promotionExists = await Promotion.findOne({ code: code.toUpperCase() });
  if (promotionExists) {
    res.status(400);
    throw new Error('Un code promotionnel avec ce nom existe déjà.');
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (start >= end) {
    res.status(400);
    throw new Error('La date de fin doit être postérieure à la date de début.');
  }

  const promotion = new Promotion({
    message,
    code: code.toUpperCase(),
    discountType,
    discountValue,
    minAmount: minAmount || 0,
    startDate: start,
    endDate: end,
    isActive: true,
  });

  const createdPromotion = await promotion.save();
  res.status(201).json(createdPromotion);
});

/**
 * @desc    Obtenir toutes les promotions (Admin seulement)
 * @route   GET /api/promotions
 * @access  Private/Admin
 */
const getPromotions = asyncHandler(async (req, res) => {
  const promotions = await Promotion.find({}).sort({ createdAt: -1 });
  res.json(promotions);
});

/**
 * @desc    Obtenir une promotion par ID (Admin seulement)
 * @route   GET /api/promotions/:id
 * @access  Private/Admin
 */
const getPromotionById = asyncHandler(async (req, res) => {
  const promotion = await Promotion.findById(req.params.id);

  if (promotion) {
    res.json(promotion);
  } else {
    res.status(404);
    throw new Error('Promotion non trouvée');
  }
});

/**
 * @desc    Mettre à jour une promotion (Admin seulement)
 * @route   PUT /api/promotions/:id
 * @access  Private/Admin
 */
const updatePromotion = asyncHandler(async (req, res) => {
  const { message, code, discountType, discountValue, minAmount, startDate, endDate, isActive } = req.body;
  const promotion = await Promotion.findById(req.params.id);

  if (promotion) {
    if (code && code.toUpperCase() !== promotion.code) {
      const existingPromotionWithCode = await Promotion.findOne({ code: code.toUpperCase() });
      if (existingPromotionWithCode && existingPromotionWithCode._id.toString() !== req.params.id) {
        res.status(400);
        throw new Error('Ce code promotionnel est déjà utilisé.');
      }
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (start >= end) {
        res.status(400);
        throw new Error('La date de fin doit être postérieure à la date de début.');
      }
    }

    promotion.message = message !== undefined ? message : promotion.message;
    promotion.code = code !== undefined ? code.toUpperCase() : promotion.code;
    promotion.discountType = discountType !== undefined ? discountType : promotion.discountType;
    promotion.discountValue = discountValue !== undefined ? discountValue : promotion.discountValue;
    promotion.minAmount = minAmount !== undefined ? minAmount : promotion.minAmount;
    promotion.startDate = startDate ? new Date(startDate) : promotion.startDate;
    promotion.endDate = endDate ? new Date(endDate) : promotion.endDate;
    promotion.isActive = typeof isActive === 'boolean' ? isActive : promotion.isActive;

    const updatedPromotion = await promotion.save();
    res.json(updatedPromotion);
  } else {
    res.status(404);
    throw new Error('Promotion non trouvée');
  }
});

/**
 * @desc    Supprimer une promotion (Admin seulement)
 * @route   DELETE /api/promotions/:id
 * @access  Private/Admin
 */
const deletePromotion = asyncHandler(async (req, res) => {
  const promotion = await Promotion.findById(req.params.id);

  if (promotion) {
    await promotion.deleteOne();
    res.json({ message: 'Promotion supprimée avec succès' });
  } else {
    res.status(404);
    throw new Error('Promotion non trouvée');
  }
});

/**
 * @desc    Activer/désactiver une promotion (Admin seulement)
 * @route   PATCH /api/promotions/:id/toggle
 * @access  Private/Admin
 */
const togglePromotion = asyncHandler(async (req, res) => {
  const promotion = await Promotion.findById(req.params.id);

  if (promotion) {
    promotion.isActive = !promotion.isActive;
    const updatedPromotion = await promotion.save();
    res.json(updatedPromotion);
  } else {
    res.status(404);
    throw new Error('Promotion non trouvée');
  }
});

/**
 * @desc    Appliquer un code promotionnel
 * @route   POST /api/promotions/apply
 * @access  Privé
 */
const applyPromotionCode = asyncHandler(async (req, res) => {
  const { code, cartTotal } = req.body;
  const now = new Date();

  const promotion = await Promotion.findOne({
    code: code.toUpperCase(),
    startDate: { $lte: now },
    endDate: { $gte: now },
    isActive: true,
  });

  if (!promotion) {
    res.status(404);
    throw new Error('Code promotionnel invalide ou expiré.');
  }

  // Vérifiez le minAmount avant de continuer
  if (cartTotal < promotion.minAmount) {
    res.status(400);
    throw new Error(
      `Le montant minimum pour cette promotion est de ${promotion.minAmount.toLocaleString('fr-FR', { style: 'currency', currency: 'XOF' })}.`
    );
  }

  let discountAmount = 0;
  let effectiveDiscountType = promotion.discountType; // Initialiser avec le type de la promotion

  // Calcul du montant de la réduction basé sur le type de promotion
  if (promotion.discountType === 'percentage') {
    discountAmount = cartTotal * (promotion.discountValue / 100);
  } else if (promotion.discountType === 'fixed') {
    discountAmount = promotion.discountValue;
  } else if (promotion.discountType === 'free_shipping') {
    // Pour la livraison gratuite, le montant de la réduction est 0
    discountAmount = 0;
    // Le type effectif reste 'free_shipping'
  }

  // S'assurer que la réduction ne dépasse pas le total du panier pour les réductions de prix
  if (effectiveDiscountType !== 'free_shipping') {
     discountAmount = Math.min(discountAmount, cartTotal);
  } else {
    // Pour 'free_shipping', discountAmount est toujours 0, pas besoin de le limiter au cartTotal
    discountAmount = 0;
  }


  res.status(200).json({
    message: 'Promotion appliquée avec succès !',
    promotion: {
      code: promotion.code,
      message: promotion.message,
      discountType: effectiveDiscountType, // Utiliser le type effectif
      discountAmount, // Inclure le montant de la réduction
    },
    newCartTotal: cartTotal - discountAmount, // Le nouveau total du panier après réduction
  });
});

export {
  getActivePromotion,
  createPromotion,
  getPromotions,
  getPromotionById,
  updatePromotion,
  deletePromotion,
  togglePromotion,
  applyPromotionCode,
};
