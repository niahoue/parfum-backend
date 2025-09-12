import express from 'express';
import {
  submitContactForm,
  getContactMessages,
  markMessageAsRead,
  deleteContactMessage,
} from '../controllers/contactController.js';
import { protect, admin } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post('/', submitContactForm);

router.get('/', protect, admin, getContactMessages);
router.patch('/:id/read', protect, admin, markMessageAsRead);
router.delete('/:id', protect, admin, deleteContactMessage);

export default router;
