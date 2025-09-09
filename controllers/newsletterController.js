// backend/controllers/newsletterController.js
import asyncHandler from 'express-async-handler';
import NewsletterSubscriber from '../models/NewsletterSubscriber.js';

/**
 * @desc    S'abonner à la newsletter
 * @route   POST /api/newsletter/subscribe
 * @access  Public
 */
const subscribeToNewsletter = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    res.status(400);
    throw new Error('Veuillez fournir une adresse email.');
  }

  // Vérifier si l'email est déjà abonné
  const existingSubscriber = await NewsletterSubscriber.findOne({ email });

  if (existingSubscriber) {
    if (existingSubscriber.isActive) {
      res.status(409); // Conflit
      throw new Error('Cette adresse email est déjà abonnée à la newsletter.');
    } else {
      // Si l'abonné existait mais était inactif, le réactiver
      existingSubscriber.isActive = true;
      await existingSubscriber.save();
      res.status(200).json({
        message: 'Votre abonnement à la newsletter a été réactivé avec succès !',
        email: existingSubscriber.email,
      });
    }
  } else {
    // Créer un nouvel abonné
    const newSubscriber = await NewsletterSubscriber.create({ email });

    if (newSubscriber) {
      res.status(201).json({
        message: 'Merci de vous être inscrit à notre newsletter !',
        email: newSubscriber.email,
      });
    } else {
      res.status(400);
      throw new Error('Données d\'abonnement invalides.');
    }
  }
});

/**
 * @desc    Se désabonner de la newsletter
 * @route   POST /api/newsletter/unsubscribe
 * @access  Public
 * Note: Dans un vrai scénario, un jeton de désabonnement sécurisé serait envoyé par email.
 * Pour cet exemple, nous allons simplifier en se basant sur l'email.
 */
const unsubscribeFromNewsletter = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    res.status(400);
    throw new Error('Veuillez fournir une adresse email.');
  }

  const subscriber = await NewsletterSubscriber.findOne({ email });

  if (subscriber) {
    if (subscriber.isActive) {
      subscriber.isActive = false; // Marque l'abonné comme inactif
      await subscriber.save();
      res.status(200).json({
        message: 'Vous avez été désabonné de la newsletter avec succès.',
      });
    } else {
      res.status(400);
      throw new Error('Cette adresse email n\'est pas abonnée ou est déjà inactive.');
    }
  } else {
    res.status(404);
    throw new Error('Aucun abonnement trouvé pour cette adresse email.');
  }
});

/**
 * @desc    Obtenir tous les abonnés (Admin seulement)
 * @route   GET /api/newsletter/subscribers
 * @access  Private/Admin
 */
const getAllSubscribers = asyncHandler(async (req, res) => {
  const subscribers = await NewsletterSubscriber.find({});
  res.status(200).json(subscribers);
});

/**
 * @desc    Mettre à jour un abonné (Admin seulement)
 * @route   PUT /api/newsletter/subscribers/:id
 * @access  Private/Admin
 */
const updateSubscriber = asyncHandler(async (req, res) => {
  const { email, isActive } = req.body;
  const subscriber = await NewsletterSubscriber.findById(req.params.id);

  if (subscriber) {
    subscriber.email = email || subscriber.email;
    subscriber.isActive = typeof isActive === 'boolean' ? isActive : subscriber.isActive;

    const updatedSubscriber = await subscriber.save();
    res.json(updatedSubscriber);
  } else {
    res.status(404);
    throw new Error('Abonné non trouvé');
  }
});

/**
 * @desc    Supprimer un abonné (Admin seulement)
 * @route   DELETE /api/newsletter/subscribers/:id
 * @access  Private/Admin
 */
const deleteSubscriber = asyncHandler(async (req, res) => {
  const subscriber = await NewsletterSubscriber.findById(req.params.id);

  if (subscriber) {
    await subscriber.deleteOne();
    res.status(200).json({ message: 'Abonné supprimé avec succès' });
  } else {
    res.status(404);
    throw new Error('Abonné non trouvé');
  }
});

export {
  subscribeToNewsletter,
  unsubscribeFromNewsletter,
  getAllSubscribers,
  updateSubscriber, // Ajout de la nouvelle fonction d'exportation
  deleteSubscriber,
};