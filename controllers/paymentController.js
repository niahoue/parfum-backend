import dotenv from 'dotenv'
import asyncHandler from 'express-async-handler';
import paydunya from 'paydunya';
import Order from '../models/Order.js';
dotenv.config()

// Configuration de PayDunya selon la documentation officielle
const setupPaydunya = () => {
  const requiredKeys = ['PAYDUNYA_MASTER_KEY', 'PAYDUNYA_PRIVATE_KEY', 'PAYDUNYA_PUBLIC_KEY', 'PAYDUNYA_TOKEN'];
  const missingKeys = requiredKeys.filter(key => !process.env[key]);
  
  if (missingKeys.length > 0) {
    throw new Error(`Variables d'environnement PayDunya manquantes: ${missingKeys.join(', ')}`);
  }

  const setup = new paydunya.Setup({
    masterKey: process.env.PAYDUNYA_MASTER_KEY,
    privateKey: process.env.PAYDUNYA_PRIVATE_KEY,
    publicKey: process.env.PAYDUNYA_PUBLIC_KEY,
    token: process.env.PAYDUNYA_TOKEN,
    mode: process.env.NODE_ENV === 'production' ? 'live' : 'test'
  });

  const store = new paydunya.Store({
    name: 'Fragrance de Mumu',
    tagline: 'Votre destination parfum de luxe',
    phoneNumber: '+225 0767758052',
    postalAddress: 'Abidjan, Côte d\'Ivoire',
    logoURL: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/logo.png` : undefined,
    returnURL: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/payment-success` : undefined,
    cancelURL: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/payment-cancel` : undefined
  });

  console.log('PayDunya configuré avec succès:', {
    masterKey: setup.masterKey ? `${setup.masterKey.substring(0, 8)}...` : 'MISSING',
    mode: setup.mode
  });

  return { setup, store };
};

// Configuration globale PayDunya
let payduyaConfig;
try {
  payduyaConfig = setupPaydunya();
  console.log('Configuration PayDunya initialisée');
} catch (error) {
  console.error('Erreur de configuration PayDunya:', error.message);
}

/**
 * @desc    Crée une facture de paiement avec PayDunya
 * @route   POST /api/payment/create
 * @access  Privé
 */
export const createPayment = asyncHandler(async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      res.status(400);
      throw new Error('ID de commande manquant');
    }

    if (!payduyaConfig) {
      throw new Error('PayDunya n\'est pas configuré correctement');
    }

    const order = await Order.findById(orderId).populate('user', 'email name');

    if (!order) {
      res.status(404);
      throw new Error('Commande non trouvée');
    }

    if (order.isPaid) {
      res.status(400);
      throw new Error('Cette commande a déjà été payée');
    }

    // Validation des données de commande
    if (!order.totalPrice || order.totalPrice <= 0) {
      res.status(400);
      throw new Error('Montant de la commande invalide');
    }

    if (!order.orderItems || order.orderItems.length === 0) {
      res.status(400);
      throw new Error('Aucun article dans la commande');
    }

    console.log('Création de la facture PayDunya pour la commande:', orderId);
    console.log('Montant total:', order.totalPrice);

    // Créer une nouvelle instance de CheckoutInvoice selon la documentation
    const invoice = new paydunya.CheckoutInvoice(payduyaConfig.setup, payduyaConfig.store);

    // Configuration de la facture
    invoice.totalAmount = order.totalPrice;
    invoice.description = `Commande #${order._id}`;

    // Ajouter les articles à la facture
    order.orderItems.forEach((item) => {
      if (!item.name || !item.qty || !item.price) {
        throw new Error(`Article invalide: propriétés manquantes`);
      }
      invoice.addItem(
        item.name, 
        item.qty, 
        item.price, 
        item.price * item.qty
      );
    });

    // Ajouter les custom data pour retrouver la commande
    invoice.addCustomData('order_id', order._id.toString());
    invoice.addCustomData('user_id', order.user._id.toString());
    invoice.addCustomData('user_email', order.user.email);

    // URLs de redirection spécifiques à cette facture (optionnel - écrase les URLs globales)
    if (process.env.FRONTEND_URL) {
      invoice.returnURL = `${process.env.FRONTEND_URL}/payment-success`;
      invoice.cancelURL = `${process.env.FRONTEND_URL}/payment-cancel`;
    }

    console.log('Tentative de création de facture PayDunya...');

    // Créer la facture avec la syntaxe Promise correcte
    const result = await invoice.create();

    console.log('Facture créée avec succès');
    console.log('Statut:', invoice.status);
    console.log('Token:', invoice.token ? `${invoice.token.substring(0, 8)}...` : 'Non disponible');

    if (invoice.token && invoice.url) {
      res.json({
        success: true,
        invoice_url: invoice.url,
        invoice_token: invoice.token,
        order_id: orderId,
        status: invoice.status,
        message: 'Facture créée avec succès'
      });
    } else {
      console.error('Réponse PayDunya incomplète:', invoice.responseText);
      res.status(500);
      throw new new Error(`Échec de la création de la facture PayDunya: ${invoice.responseText || 'Token ou URL manquant'}`);
    }

  } catch (error) {
    console.error('Erreur dans createPayment:', error);
    console.error('Stack trace:', error.stack);
    
    // Log des variables d'environnement pour débogage
    console.error('Variables d\'environnement PayDunya présentes:', {
      PAYDUNYA_MASTER_KEY: !!process.env.PAYDUNYA_MASTER_KEY,
      PAYDUNYA_PRIVATE_KEY: !!process.env.PAYDUNYA_PRIVATE_KEY,
      PAYDUNYA_PUBLIC_KEY: !!process.env.PAYDUNYA_PUBLIC_KEY,
      PAYDUNYA_TOKEN: !!process.env.PAYDUNYA_TOKEN,
      NODE_ENV: process.env.NODE_ENV,
      FRONTEND_URL: !!process.env.FRONTEND_URL
    });

    res.status(500);
    throw new Error(error.message || 'Erreur lors de la création du paiement');
  }
});

/**
 * @desc    Gère la redirection de PayDunya après le paiement
 * @route   GET /api/payment/callback
 * @access  Public
 */

/**
 * @desc    Gère la redirection de PayDunya après le paiement
 * @route   GET /api/payment/callback
 * @access  Public
 */
export const handlePaydunyaCallback = asyncHandler(async (req, res) => {
  try {
    const { token, invoice_token } = req.query;
    const actualToken = token || invoice_token;

    if (!actualToken) {
      console.error('Token manquant dans le callback:', req.query);
      return res.redirect(`${process.env.FRONTEND_URL}/payment-cancel?message=${encodeURIComponent('Jeton de facture manquant')}`);
    }

    if (!payduyaConfig) {
      console.error('PayDunya non configuré pour le callback');
      return res.redirect(`${process.env.FRONTEND_URL}/payment-cancel?message=${encodeURIComponent('Erreur de configuration PayDunya')}`);
    }

    console.log('Traitement du callback PayDunya pour le token:', actualToken.substring(0, 8) + '...');

    // Créer une instance pour vérifier la facture selon la documentation
    const invoice = new paydunya.CheckoutInvoice(payduyaConfig.setup, payduyaConfig.store);

    try {
      // Confirmer la facture avec le token
      await invoice.confirm(actualToken);
      console.log('Résultat de confirmation callback:', invoice.status);

      // Récupérer les custom data de la facture
      const customData = invoice.customData || {};
      const orderId = customData.order_id;

      if (!orderId) {
        console.error('order_id manquant dans custom_data:', customData);
        // Rediriger avec le token pour que le frontend puisse essayer de trouver la commande
        return res.redirect(`${process.env.FRONTEND_URL}/payment-success?token=${actualToken}&message=${encodeURIComponent('Données de commande manquantes')}`);
      }

      if (invoice.status === 'completed') {
        const order = await Order.findById(orderId);

        if (order && !order.isPaid) {
          order.isPaid = true;
          order.paidAt = new Date();
          order.paymentResult = {
            id: actualToken,
            status: 'completed',
            update_time: new Date().toISOString(),
            email_address: invoice.customer?.email || customData.user_email
          };

          await order.save();
          console.log(`Commande ${orderId} marquée comme payée via callback`);
        }

        // CORRECTION PRINCIPALE: Inclure TOUJOURS l'orderId dans la redirection
        return res.redirect(`${process.env.FRONTEND_URL}/payment-success?orderId=${orderId}&token=${actualToken}`);
      } else {
        console.error('Paiement non confirmé, statut:', invoice.status);
        // Inclure l'orderId même en cas d'échec
        return res.redirect(`${process.env.FRONTEND_URL}/payment-cancel?orderId=${orderId}&token=${actualToken}&reason=${invoice.status}&message=${encodeURIComponent(`Paiement non confirmé (${invoice.status})`)}`);
      }

    } catch (confirmError) {
      console.error('Erreur de confirmation dans callback:', confirmError);
      // En cas d'erreur, rediriger avec le token seulement
      return res.redirect(`${process.env.FRONTEND_URL}/payment-success?token=${actualToken}&message=${encodeURIComponent('Erreur de vérification, veuillez contacter le support')}`);
    }

  } catch (error) {
    console.error('Erreur dans handlePaydunyaCallback:', error);
    const fallbackToken = req.query.token || req.query.invoice_token;
    const redirectUrl = fallbackToken
      ? `${process.env.FRONTEND_URL}/payment-success?token=${fallbackToken}&message=${encodeURIComponent('Erreur lors de la vérification: ' + error.message)}`
      : `${process.env.FRONTEND_URL}/payment-cancel?reason=error&message=${encodeURIComponent('Erreur lors de la vérification: ' + error.message)}`;
    return res.redirect(redirectUrl);
  }
});

/**
 * @desc    Gère les webhooks de PayDunya
 * @route   POST /api/payment/webhook
 * @access  Public
 */
export const handlePaydunyaWebhook = asyncHandler(async (req, res) => {
  try {
    console.log('Webhook PayDunya reçu:', req.body);
    
    const { invoice_token, token, data } = req.body;
    const actualToken = invoice_token || token || data?.invoice_token;

    if (!actualToken) {
      console.error('Token manquant dans le webhook:', req.body);
      return res.status(200).json({ status: 'error', message: 'Token manquant' });
    }

    if (!payduyaConfig) {
      console.error('PayDunya non configuré pour le webhook');
      return res.status(200).json({ status: 'error', message: 'Configuration manquante' });
    }

    // Créer une instance pour vérifier la facture
    const invoice = new paydunya.CheckoutInvoice(payduyaConfig.setup, payduyaConfig.store);
    
    try {
      // Confirmer la facture
      await invoice.confirm(actualToken);
      
      console.log('Résultat de confirmation webhook:', invoice.status);

      if (invoice.status === 'completed') {
        const customData = invoice.customData || {};
        const orderId = customData.order_id;
        
        if (orderId) {
          const order = await Order.findById(orderId);

          if (order && !order.isPaid) {
            order.isPaid = true;
            order.paidAt = new Date();
            order.paymentResult = {
              id: actualToken,
              status: 'completed',
              update_time: new Date().toISOString(),
              email_address: invoice.customer?.email || customData.user_email
            };

            await order.save();
            console.log(`Webhook PayDunya: Commande ${orderId} mise à jour avec succès.`);
          } else {
            console.log(`Webhook PayDunya: Commande ${orderId} déjà traitée ou introuvable.`);
          }
        } else {
          console.error('order_id manquant dans les données webhook custom_data:', customData);
        }
      } else {
        console.log('Webhook PayDunya: Statut non confirmé:', invoice.status);
      }
    } catch (confirmError) {
      console.error('Erreur de confirmation webhook:', confirmError);
    }

    // Toujours répondre 200 pour les webhooks
    res.status(200).json({ status: 'received' });

  } catch (error) {
    console.error('Erreur dans handlePaydunyaWebhook:', error);
    // Répondre 200 même en cas d'erreur pour éviter les re-tentatives infinies
    res.status(200).json({ status: 'error', message: error.message });
  }
});


/**
 * @desc    Vérifie le statut d'une commande via PayDunya après un paiement (appelé par le frontend)
 * @route   POST /api/payment/verify/:orderId
 * @access  Privé (utilisateur connecté ou admin)
 */
export const verifyPaymentStatus = asyncHandler(async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      res.status(400);
      throw new Error('ID de commande manquant');
    }

    if (!payduyaConfig) {
      throw new Error('PayDunya n\'est pas configuré correctement');
    }

    const order = await Order.findById(orderId).populate('user', 'email name');

    if (!order) {
      res.status(404);
      throw new Error('Commande non trouvée');
    }

    // Si la commande est déjà payée, pas besoin de vérifier PayDunya
    if (order.isPaid) {
      return res.status(200).json({
        message: 'Paiement déjà confirmé',
        orderId: order._id,
        isPaid: true,
        paymentResult: order.paymentResult
      });
    }

    // Assurez-vous d'avoir le token de la transaction PayDunya stocké avec la commande
    // Cela dépend de comment vous stockez le token de l'invoice générée initialement.
    // Pour l'exemple, nous allons supposer que le token est disponible via customData ou une référence.
    // Idéalement, le token PayDunya devrait être stocké sur l'objet Order lors de la création de la facture.
    // Si ce n'est pas le cas, vous ne pourrez pas confirmer le paiement avec PayDunya directement ici.
    // Pour cette implémentation, je vais simuler un token pour l'appel de confirmation.
    // Pour une vraie intégration, il faudrait que Order.paymentResult.id ou un champ similaire contienne le token PayDunya.

    let actualToken = order.paymentResult?.id; // Tentative de récupération du token
    
    // Si le token n'est pas trouvé, le processus de vérification ne peut pas continuer.
    if (!actualToken) {
      // Pour les cas où le callback n'a pas mis à jour l'ordre avec le token PayDunya
      // Alternative: essayer de rechercher l'invoice par un autre moyen si PayDunya le permet
      // Ou demander au frontend de fournir le token si elle le possède (moins sécurisé)
      console.warn(`Token PayDunya manquant pour la commande ${orderId}. Ne peut pas vérifier directement.`);
      return res.status(400).json({
        message: 'Impossible de vérifier le paiement: Jeton de transaction PayDunya manquant sur la commande.',
        orderId: order._id,
        isPaid: order.isPaid // Renvoie le statut actuel
      });
    }

    const invoice = new paydunya.CheckoutInvoice(payduyaConfig.setup, payduyaConfig.store);
    await invoice.confirm(actualToken); // Confirme le statut de l'invoice avec PayDunya

    if (invoice.status === 'completed') {
      order.isPaid = true;
      order.paidAt = new Date();
      order.paymentResult = {
        id: actualToken,
        status: 'completed',
        update_time: new Date().toISOString(),
        email_address: invoice.customer?.email || order.user.email
      };
      await order.save();
      console.log(`Paiement de la commande ${orderId} confirmé et mis à jour via vérification.`);
      res.status(200).json({
        message: 'Paiement confirmé avec succès',
        orderId: order._id,
        isPaid: true,
        paymentResult: order.paymentResult
      });
    } else {
      console.log(`Paiement de la commande ${orderId} non confirmé, statut PayDunya: ${invoice.status}`);
      res.status(200).json({
        message: `Paiement non confirmé: ${invoice.status}`,
        orderId: order._id,
        isPaid: false, // Toujours false si PayDunya ne confirme pas
        paydunyaStatus: invoice.status
      });
    }

  } catch (error) {
    console.error('Erreur dans verifyPaymentStatus:', error);
    res.status(500);
    throw new Error(error.message || 'Erreur lors de la vérification du paiement');
  }
});


export const findOrderByToken = asyncHandler(async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      res.status(400);
      throw new Error('Token manquant');
    }

    if (!payduyaConfig) {
      throw new Error('PayDunya n\'est pas configuré correctement');
    }

    console.log('Recherche de commande par token:', token.substring(0, 8) + '...');

    // Créer une instance pour vérifier la facture
    const invoice = new paydunya.CheckoutInvoice(payduyaConfig.setup, payduyaConfig.store);
    await invoice.confirm(token);

    const customData = invoice.customData || {};
    const orderId = customData.order_id;

    if (!orderId) {
      res.status(404);
      throw new Error('Commande non trouvée pour ce token');
    }

    const order = await Order.findById(orderId).populate('user', 'email name');

    if (!order) {
      res.status(404);
      throw new Error('Commande non trouvée');
    }

    // Mettre à jour le statut de paiement si nécessaire
    if (invoice.status === 'completed' && !order.isPaid) {
      order.isPaid = true;
      order.paidAt = new Date();
      order.paymentResult = {
        id: token,
        status: 'completed',
        update_time: new Date().toISOString(),
        email_address: invoice.customer?.email || customData.user_email
      };
      await order.save();
      console.log(`Commande ${orderId} mise à jour via findOrderByToken`);
    }

    res.json({
      success: true,
      orderId: order._id,
      order: order,
      paymentStatus: invoice.status,
      message: 'Commande trouvée avec succès'
    });

  } catch (error) {
    console.error('Erreur dans findOrderByToken:', error);
    res.status(500);
    throw new Error(error.message || 'Erreur lors de la recherche de commande');
  }
});
