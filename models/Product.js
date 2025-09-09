import mongoose from 'mongoose';

// Schéma pour les avis (reviews)
const reviewSchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    rating: { type: Number, required: true },
    comment: { type: String, required: true },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User', // Référence au modèle User
    },
  },
  {
    timestamps: true, // Ajoute automatiquement createdAt et updatedAt pour chaque avis
  }
);

const productSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    brand: {
      type: String,
      required: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    price: {
      type: Number,
      required: true,
      default: 0,
    },
    originalPrice: { type: Number },
    countInStock: {
      type: Number,
      required: true,
      default: 0,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    rating: { // Note moyenne du produit
      type: Number,
      required: true,
      default: 0,
    },
    numReviews: { // Nombre total d'avis
      type: Number,
      required: true,
      default: 0,
    },
    reviews: [reviewSchema],
    isNewProduct: {
      type: Boolean,
      default: false,
    },
    isBestSeller: {
      type: Boolean,
      default: false,
    },
    type: { type: String }, // Ex: Eau de Parfum, Eau de Toilette
    size: { type: String }, // Ex: 50ml, 100ml
    notes: [{ type: String }], // Ex: boisé, floral
  },
  {
    timestamps: true, // Ajoute automatiquement createdAt et updatedAt pour le produit lui-même
  }
);

export default mongoose.model('Product', productSchema);
