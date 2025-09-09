// backend/models/NewsletterSubscriber.js
import mongoose from 'mongoose';

const newsletterSubscriberSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'L\'adresse email est requise pour l\'abonnement à la newsletter'],
      unique: true, // Assure que chaque email est unique
      lowercase: true, // Convertit l'email en minuscules avant de sauvegarder
      trim: true, // Supprime les espaces blancs inutiles
       match: [
      /^(([^<>()\[\]\\.,;:\s@"]+(\\.[^<>()\[\]\\.,;:\\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-1]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
      'Veuillez utiliser une adresse email valide'
    ]
    },
    subscribedAt: {
      type: Date,
      default: Date.now, // Date d'abonnement par défaut à la date actuelle
    },
    isActive: {
      type: Boolean,
      default: true, // L'abonné est actif par défaut
    },
    // Vous pouvez ajouter d'autres champs si nécessaire, comme la source d'inscription, etc.
  },
  {
    timestamps: true, // Ajoute automatiquement createdAt et updatedAt
  }
);

const NewsletterSubscriber = mongoose.model('NewsletterSubscriber', newsletterSubscriberSchema);

export default NewsletterSubscriber;
