// controllers/orderController.js
import asyncHandler from 'express-async-handler';
import Order from '../models/Order.js';
import { sendOrderConfirmationEmail } from '../utils/emailService.js'; // Importez le service d'email

/**
 * @desc    Crée une nouvelle commande
 * @route   POST /api/orders
 * @access  Privé
 */
const addOrderItems = asyncHandler(async (req, res) => {
  const {
    orderItems,
    shippingAddress,
    paymentMethod,
    taxPrice,
    shippingPrice,
    totalPrice,
  } = req.body;

  if (orderItems && orderItems.length === 0) {
    res.status(400);
    throw new Error('Aucun article de commande');
  } else {
    const order = new Order({
      orderItems,
      user: req.user._id,
      shippingAddress,
      paymentMethod,
      taxPrice,
      shippingPrice,
      totalPrice,
    });

    const createdOrder = await order.save();

    // Envoi de l'email de confirmation après la création de la commande
    if (createdOrder) {
      const populatedOrder = await Order.findById(createdOrder._id).populate('user', 'name email').exec();
      if (populatedOrder && populatedOrder.user && populatedOrder.user.email) {
          sendOrderConfirmationEmail({
            ...populatedOrder._doc,
            userEmail: populatedOrder.user.email
          });
      } else {
          console.warn("Impossible d'envoyer l'email de confirmation: utilisateur ou email non trouvé.");
      }
    }

    res.status(201).json(createdOrder);
  }
});

/**
 * @desc    Obtenir une commande par ID
 * @route   GET /api/orders/:id
 * @access  Privé (propriétaire de la commande ou Admin)
 */
const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate(
    'user',
    'name email'
  ).populate(
    'orderItems.product', // Populer les détails du produit pour chaque article
    'name imageUrl price' // Champs à populater du produit
  );

  if (order) {
    // Vérifier si l'utilisateur est le propriétaire ou un administrateur
    if (order.user._id.toString() === req.user._id.toString() || req.user.isAdmin) {
      res.json(order);
    } else {
      res.status(401);
      throw new Error('Non autorisé à voir cette commande');
    }
  } else {
    res.status(404);
    throw new Error('Commande non trouvée');
  }
});

/**
 * @desc    Mettre à jour le statut de paiement de la commande
 * @route   PUT /api/orders/:id/pay
 * @access  Privé
 */
const updateOrderToPaid = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (order) {
    order.isPaid = true;
    order.paidAt = Date.now();
    order.paymentResult = {
      id: req.body.id,
      status: req.body.status,
      update_time: req.body.update_time,
      email_address: req.body.email_address,
    };

    const updatedOrder = await order.save();
    res.json(updatedOrder);
  } else {
    res.status(404);
    throw new Error('Commande non trouvée');
  }
});

/**
 * @desc    Obtenir les commandes de l'utilisateur connecté
 * @route   GET /api/orders/myorders
 * @access  Privé
 */
const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).populate(
    'orderItems.product',
    'name imageUrl'
  ).sort({ createdAt: -1 }); // Trier par les plus récentes
  res.json(orders);
});

/**
 * @desc    Obtenir toutes les commandes (Admin seulement)
 * @route   GET /api/orders
 * @access  Privé/Admin
 */
const getOrders = asyncHandler(async (req, res) => {
  try {
    const orders = await Order.find({})
      .populate({
        path: 'user',
        select: 'name email',
        // Ajouter une option pour gérer les cas où l'utilisateur n'existe plus
        options: { strictPopulate: false }
      })
      .sort({ createdAt: -1 });
    
    // Log pour débugger
    console.log('Orders récupérées:', orders.length);
    orders.forEach(order => {
      console.log(`Order ${order._id}:`, {
        userId: order.user?._id,
        userName: order.user?.name,
        userEmail: order.user?.email
      });
    });
    
    res.json(orders);
  } catch (error) {
    console.error('Erreur lors de la récupération des commandes:', error);
    res.status(500);
    throw new Error('Erreur lors de la récupération des commandes');
  }
});

/**
 * @desc    Mettre à jour le statut de livraison de la commande (Admin seulement)
 * @route   PUT /api/orders/:id/deliver
 * @access  Privé/Admin
 */
const updateOrderToDelivered = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (order) {
    order.isDelivered = true;
    order.deliveredAt = Date.now(); // Enregistre la date de livraison

    const updatedOrder = await order.save();
    res.json(updatedOrder);
  } else {
    res.status(404);
    throw new Error('Commande non trouvée');
  }
});

/**
 * @desc    Supprimer une commande (Admin seulement)
 * @route   DELETE /api/orders/:id
 * @access  Privé/Admin
 */
const deleteOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (order) {
    await order.deleteOne();
    res.json({ message: 'Commande supprimée avec succès' });
  } else {
    res.status(404);
    throw new Error('Commande non trouvée');
  }
});

export {
  addOrderItems,
  getOrderById,
  updateOrderToPaid,
  getMyOrders,
  getOrders,
  updateOrderToDelivered,
  deleteOrder,
};