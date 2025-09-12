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
    rating: { 
      type: Number,
      required: true,
      default: 0,
    },
    numReviews: { 
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
    type: { type: String }, 
    size: { type: String }, 
    notes: [{ type: String }], 
  },
  {
    timestamps: true,
  }
);
// Middleware Mongoose pour recalculer la note et le nombre d'avis
productSchema.pre('save', function(next) {
  if (this.isModified('reviews')) {
    const numReviews = this.reviews.length;
    const totalRating = this.reviews.reduce((sum, review) => sum + review.rating, 0);
    this.numReviews = numReviews;
    this.rating = numReviews > 0 ? (totalRating / numReviews) : 0;
  }
  next();
});

productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ category: 1, brand: 1 }); 
productSchema.index({ rating: -1, numReviews: -1 })

export default mongoose.model('Product', productSchema);
