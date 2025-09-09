import asyncHandler from 'express-async-handler';
import Product from '../models/Product.js';
import cloudinary from '../config/cloudinary.js';
import { cacheManager } from '../utils/cacheManager.js';

// Correction complète de la fonction getProducts dans productController.js
const getProducts = asyncHandler(async (req, res) => {
  const pageSize = Number(req.query.pageSize) || 10;
  const page = Number(req.query.pageNumber) || 1;

  console.log('Paramètres de requête reçus:', req.query); // Debug

  // Génération de clé de cache basée sur tous les paramètres
  const cacheParams = {
    page,
    pageSize,
    keyword: req.query.keyword || '',
    brand: req.query.brand || '',
    category: req.query.category || '',
    minPrice: req.query.minPrice || '',
    maxPrice: req.query.maxPrice || '',
    isNew: req.query.isNew || req.query.isNewProduct || '',
    isBestSeller: req.query.isBestSeller || '',
    type: req.query.type || ''
  };
  
  const cacheKey = cacheManager.generateKey('products', 'list', cacheParams);
  
  // Tentative de récupération depuis le cache
  const cachedResult = await cacheManager.get(cacheKey);
  if (cachedResult) {
    console.log('Résultat depuis le cache:', cachedResult.products.length, 'produits');
    return res.json(cachedResult);
  }

  // Construction des filtres
  let filters = {};

  // Filtre par mot-clé
  if (req.query.keyword) {
    filters.name = {
      $regex: req.query.keyword,
      $options: 'i',
    };
  }

  // Filtre par marque
  if (req.query.brand) {
    filters.brand = { $regex: new RegExp(req.query.brand, 'i') };
  }

  // Filtre par type de produit
  if (req.query.type) {
    filters.type = { $regex: new RegExp(req.query.type, 'i') };
  }

  // Filtrage par catégorie - accepter nom ou ID
  if (req.query.category) {
    const categoryValue = req.query.category;
    
    // Si c'est un ObjectId MongoDB (24 caractères hexadécimaux)
    if (/^[0-9a-fA-F]{24}$/.test(categoryValue)) {
      filters.category = categoryValue;
    } else {
      // Sinon chercher par nom de catégorie
      try {
        const Category = (await import('../models/Category.js')).default;
        const foundCategory = await Category.findOne({ 
          name: { $regex: new RegExp(categoryValue, 'i') } 
        });
        if (foundCategory) {
          filters.category = foundCategory._id;
        } else {
          console.log('Catégorie non trouvée:', categoryValue);
        }
      } catch (err) {
        console.warn('Erreur lors de la recherche de catégorie:', err);
      }
    }
  }

  // Filtre par prix
  if (req.query.minPrice || req.query.maxPrice) {
    filters.price = {};
    if (req.query.minPrice) filters.price.$gte = Number(req.query.minPrice);
    if (req.query.maxPrice) filters.price.$lte = Number(req.query.maxPrice);
  }

  // Filtre pour les nouveautés (accepte isNew ou isNewProduct)
  if (req.query.isNew === 'true' || req.query.isNewProduct === 'true') {
    filters.isNew = true;
  }

  // Filtre pour les best-sellers
  if (req.query.isBestSeller === 'true') {
    filters.isBestSeller = true;
  }

  console.log('Filtres appliqués:', JSON.stringify(filters, null, 2)); // Debug

  try {
    // Exécution parallèle des requêtes pour optimiser
    const [count, products] = await Promise.all([
      Product.countDocuments(filters),
      Product.find(filters)
        .limit(pageSize)
        .skip(pageSize * (page - 1))
        .populate('category', 'name')
        .sort({ createdAt: -1 }) // Trier par date de création décroissante
        .lean() // Optimisation MongoDB - retourne des objets JS purs
    ]);

    console.log('Produits trouvés:', products.length); // Debug

    const result = { 
      products, 
      page, 
      pages: Math.ceil(count / pageSize),
      total: count
    };

    // Mise en cache avec TTL de 30 minutes
    await cacheManager.set(cacheKey, result, 1800);

    res.json(result);
  } catch (error) {
    console.error('Erreur lors de la récupération des produits:', error);
    res.status(500);
    throw new Error('Erreur lors de la récupération des produits');
  }
});
// @desc    Fetch single product avec cache
// @route   GET /api/products/:id
// @access  Public
const getProductById = asyncHandler(async (req, res) => {
  const cacheKey = cacheManager.generateKey('products', `single:${req.params.id}`);
  
  // Vérification cache
  const cachedProduct = await cacheManager.get(cacheKey);
  if (cachedProduct) {
    return res.json(cachedProduct);
  }

  const product = await Product.findById(req.params.id)
    .populate('category', 'name')
    .lean();

  if (product) {
    // Cache pour 1 heure
    await cacheManager.set(cacheKey, product, 3600);
    res.json(product);
  } else {
    res.status(404);
    throw new Error('Produit non trouvé');
  }
});

// @desc    Delete a product avec invalidation cache
// @route   DELETE /api/products/:id
// @access  Private/Admin
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (product) {
    // Suppression de l'image Cloudinary
    if (product.imageUrl) {
      const publicId = product.imageUrl.split('/').pop().split('.')[0];
      await cloudinary.uploader.destroy(`fragrance-de-mumu/products/${publicId}`);
    }
    
    await product.deleteOne();
    
    // Invalidation intelligente du cache
    await Promise.all([
      cacheManager.invalidate(cacheManager.generateKey('products', `single:${req.params.id}`)),
      cacheManager.invalidateByPattern('products:list'), // Invalide toutes les listes
      cacheManager.invalidateByPattern('stats'), // Invalide les stats
    ]);
    
    res.json({ message: 'Produit supprimé' });
  } else {
    res.status(404);
    throw new Error('Produit non trouvé');
  }
});

// @desc    Create a product avec invalidation cache
// @route   POST /api/products
// @access  Private/Admin
const createProduct = asyncHandler(async (req, res) => {
  const {
    name, price, originalPrice, description, brand, category, countInStock,
    isNew, isBestSeller, type, size, notes
  } = req.body;
  const file = req.file;

  // Validation des champs obligatoires
  if (!name || !price || !description || !brand || !category) {
    res.status(400);
    throw new Error('Veuillez remplir tous les champs obligatoires');
  }

  if (!file) {
    res.status(400);
    throw new Error('Veuillez télécharger une image pour le nouveau produit');
  }

  // Upload de l'image sur Cloudinary
  let imageUrl = '';
  try {
    const dataUri = 'data:' + file.mimetype + ';base64,' + file.buffer.toString('base64');
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: 'Fragrance-de-mumu/products',
      format: 'webp',
      quality: 'auto',
      fetch_format: 'auto'
    });
    imageUrl = result.secure_url;
  } catch (uploadError) {
    console.error('Erreur Cloudinary lors de la création du produit:', uploadError);
    res.status(500);
    throw new Error('Échec du téléchargement de l\'image sur Cloudinary: ' + uploadError.message);
  }

  // Traitement des notes
  let notesArray = [];
  if (notes && typeof notes === 'string') {
    notesArray = notes.split(',').map(n => n.trim()).filter(Boolean);
  }

  // Création du nouveau produit
  const product = new Product({
    name,
    price: Number(price),
    originalPrice: originalPrice ? Number(originalPrice) : Number(price),
    user: req.user._id,
    imageUrl,
    brand,
    category,
    countInStock: Number(countInStock),
    description,
    isNew: isNew === 'true' || isNew === true,
    isBestSeller: isBestSeller === 'true' || isBestSeller === true,
    type: type || '',
    size: size || '',
    notes: notesArray,
    rating: 0,
    numReviews: 0,
  });

  const createdProduct = await product.save();
  await createdProduct.populate('category', 'name');

  // Invalidation du cache après création
  await Promise.all([
    cacheManager.invalidateByPattern('products:list'),
    cacheManager.invalidateByPattern('stats'),
    // Préchauffe le cache pour ce nouveau produit
    cacheManager.set(
      cacheManager.generateKey('products', `single:${createdProduct._id}`), 
      createdProduct.toObject(), 
      3600
    )
  ]);

  res.status(201).json(createdProduct);
});

// @desc    Update a product avec gestion cache intelligente
// @route   PUT /api/products/:id
// @access  Private/Admin
const updateProduct = asyncHandler(async (req, res) => {
  const {
    name, price, originalPrice, description, brand, category, countInStock,
    isNew, isBestSeller, type, size, notes, imageUrl: existingImageUrl
  } = req.body;
  const file = req.file;

  const product = await Product.findById(req.params.id);

  if (product) {
    // Mise à jour des champs
    product.name = name !== undefined ? name : product.name;
    product.price = price !== undefined ? Number(price) : product.price;
    product.originalPrice = originalPrice !== undefined ? Number(originalPrice) : product.originalPrice;
    product.description = description !== undefined ? description : product.description;
    product.brand = brand !== undefined ? brand : product.brand;
    product.category = category !== undefined ? category : product.category;
    product.countInStock = countInStock !== undefined ? Number(countInStock) : product.countInStock;
    product.isNew = isNew !== undefined ? (isNew === 'true' || isNew === true) : product.isNew;
    product.isBestSeller = isBestSeller !== undefined ? (isBestSeller === 'true' || isBestSeller === true) : product.isBestSeller;
    product.type = type !== undefined ? type : product.type;
    product.size = size !== undefined ? size : product.size;
    
    if (notes !== undefined) {
      product.notes = typeof notes === 'string' 
        ? notes.split(',').map(n => n.trim()).filter(Boolean) 
        : notes;
    }

    // Gestion de l'image
    if (file) {
      try {
        if (product.imageUrl && !product.imageUrl.includes('placehold.co')) {
          const publicId = product.imageUrl.split('/').pop().split('.')[0];
          await cloudinary.uploader.destroy(`fragrance-de-mumu/products/${publicId}`);
        }
        const dataUri = 'data:' + file.mimetype + ';base64,' + file.buffer.toString('base64');
        const result = await cloudinary.uploader.upload(dataUri, {
          folder: 'fragrance-de-mumu/products',
          format: 'webp',
          quality: 'auto',
          fetch_format: 'auto'
        });
        product.imageUrl = result.secure_url;
      } catch (uploadError) {
        console.error('Erreur Cloudinary lors de la mise à jour du produit:', uploadError);
        res.status(500);
        throw new Error('Échec du téléchargement de la nouvelle image sur Cloudinary: ' + uploadError.message);
      }
    } else if (existingImageUrl === '') {
      product.imageUrl = '';
    }

    const updatedProduct = await product.save();
    await updatedProduct.populate('category', 'name');

    // Invalidation et mise à jour du cache
    await Promise.all([
      cacheManager.invalidate(cacheManager.generateKey('products', `single:${req.params.id}`)),
      cacheManager.invalidateByPattern('products:list'),
      cacheManager.invalidateByPattern('stats'),
      // Remet en cache le produit mis à jour
      cacheManager.set(
        cacheManager.generateKey('products', `single:${req.params.id}`), 
        updatedProduct.toObject(), 
        3600
      )
    ]);

    res.json(updatedProduct);
  } else {
    res.status(404);
    throw new Error('Produit non trouvé');
  }
});

// @desc    Create new review avec invalidation cache
// @route   POST /api/products/:id/reviews
// @access  Private
const createProductReview = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;
  const product = await Product.findById(req.params.id);

  if (product) {
    const alreadyReviewed = product.reviews.find(
      (r) => r.user.toString() === req.user._id.toString()
    );

    if (alreadyReviewed) {
      res.status(400);
      throw new Error('Produit déjà commenté');
    }

    const review = {
      name: req.user.name || req.user.email || 'Utilisateur Anonyme',
      rating: Number(rating),
      comment,
      user: req.user._id,
    };

    product.reviews.push(review);
    product.numReviews = product.reviews.length;
    product.rating = product.reviews.reduce((acc, item) => item.rating + acc, 0) / product.reviews.length;

    await product.save();

    // Invalidation du cache pour ce produit spécifique
    await Promise.all([
      cacheManager.invalidate(cacheManager.generateKey('products', `single:${req.params.id}`)),
      cacheManager.invalidateByPattern('products:list'), // Les listes incluent les ratings
    ]);

    res.status(201).json({ message: 'Avis ajouté' });
  } else {
    res.status(404);
    throw new Error('Produit non trouvé');
  }
});

export { 
  getProducts, 
  getProductById, 
  deleteProduct, 
  createProduct, 
  updateProduct, 
  createProductReview 
};