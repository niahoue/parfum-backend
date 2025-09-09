import asyncHandler from 'express-async-handler';
import ContactMessage from '../models/ContactMessage.js';
import { sendContactEmail } from '../utils/emailService.js'; 

/**
 * @desc    Soumettre un nouveau message de contact
 * @route   POST /api/contact
 * @access  Public
 */
const submitContactForm = asyncHandler(async (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    res.status(400);
    throw new Error('Veuillez remplir tous les champs.');
  }

  const contactMessage = await ContactMessage.create({ name, email, subject, message });

  if (contactMessage) {
    try {
      await sendContactEmail({ name, email, subject, message });
      res.status(201).json({
        success: true,
        message: 'Votre message a été envoyé avec succès !',
      });
    } catch (error) {
      console.error("⚠️ Message enregistré mais échec de l'email :", error.message);
      res.status(201).json({
        success: true,
        message: "Message enregistré, mais l'email n'a pas pu être envoyé.",
      });
    }
  } else {
    res.status(400);
    throw new Error('Données de message invalides');
  }
});


// Exemple de fonctions futures (admin)
const getContactMessages = asyncHandler(async (req, res) => {
  const messages = await ContactMessage.find().sort({ createdAt: -1 });
  res.json(messages);
});

const markMessageAsRead = asyncHandler(async (req, res) => {
  const message = await ContactMessage.findById(req.params.id);
  if (!message) {
    res.status(404);
    throw new Error('Message non trouvé');
  }
  message.isRead = true;
  await message.save();
  res.json({ success: true, message: 'Message marqué comme lu' });
});

const deleteContactMessage = asyncHandler(async (req, res) => {
  const message = await ContactMessage.findById(req.params.id);
  if (!message) {
    res.status(404);
    throw new Error('Message non trouvé');
  }
  await message.deleteOne();
  res.json({ success: true, message: 'Message supprimé' });
});

export {
  submitContactForm,
  getContactMessages,
  markMessageAsRead,
  deleteContactMessage,
};
