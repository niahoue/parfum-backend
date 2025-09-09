// backend/models/Promotion.js
import mongoose from 'mongoose';

const promotionSchema = new mongoose.Schema(
  {
    // Message affiché pour la promotion (ex: "15% de réduction sur votre première commande")
    message: {
      type: String,
      required: [true, 'Le message de la promotion est requis'],
      trim: true,
    },
    // Code unique que le client devra entrer (ex: "WELCOME15")
    code: {
      type: String,
      required: [true, 'Le code promotionnel est requis'], // Rendu requis
      unique: true,
      uppercase: true, // Assure que le code est toujours en majuscules
      trim: true,
    },
    // Type de réduction (pourcentage ou montant fixe)
    discountType: {
      type: String,
      enum: ['percentage', 'fixed','free_shipping'], // 'percentage' pour %, 'fixed' pour montant fixe
      required: [true, 'Le type de réduction est requis (percentage , fixed ou free)'],
    },
    // Valeur de la réduction (ex: 15 pour 15%, ou 5000 pour 5000 XOF de réduction)
    discountValue: {
      type: Number,
      required: [true, 'La valeur de la réduction est requise'],
      min: [0, 'La valeur de la réduction ne peut pas être négative'],
    },
    // Montant minimum de commande pour que la promotion soit applicable
    minAmount: {
      type: Number,
      default: 0,
      min: [0, 'Le montant minimum ne peut pas être négatif'],
    },
    // Date de début de validité de la promotion
    startDate: {
      type: Date,
      required: [true, 'La date de début de la promotion est requise'],
    },
    // Date de fin de validité de la promotion
    endDate: {
      type: Date,
      required: [true, 'La date de fin de la promotion est requise'],
    },
    // Si la promotion est active ou non (peut être désactivée manuellement)
    isActive: {
      type: Boolean,
      default: true, // Par défaut, une nouvelle promotion est active
    },
  },
  {
    timestamps: true, // Ajoute createdAt et updatedAt automatiquement
  }
);

// Middleware pour définir isActive en fonction des dates
promotionSchema.pre('save', function(next) {
  const now = new Date();
  this.isActive = this.startDate <= now && this.endDate >= now;
  next();
});

const Promotion = mongoose.model('Promotion', promotionSchema);

export default Promotion;
