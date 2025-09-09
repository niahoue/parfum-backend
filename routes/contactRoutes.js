import express from 'express';
import {
  submitContactForm,
  getContactMessages,
  markMessageAsRead,
  deleteContactMessage,
} from '../controllers/contactController.js';

const router = express.Router();

// Route publique
router.post('/', submitContactForm);

// Routes admin (ajouter une middleware d’authentification + rôle admin plus tard)
router.get('/', getContactMessages);
router.patch('/:id/read', markMessageAsRead);
router.delete('/:id', deleteContactMessage);

export default router;
