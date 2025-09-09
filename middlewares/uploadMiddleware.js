import multer from 'multer';

// Configuration de Multer pour gérer l'upload d'un seul fichier image
const storage = multer.memoryStorage(); // Stocke le fichier en mémoire

// Configuration avec validation des fichiers
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // Limite de 5MB
  },
  fileFilter: (req, file, cb) => {
    console.log('Fichier reçu par multer:', file);
    
    // Vérifier le type de fichier
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers image sont autorisés!'), false);
    }
  }
});

// Middleware d'erreur pour multer
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        message: 'Le fichier est trop volumineux. Taille maximum: 5MB'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        message: 'Champ de fichier inattendu'
      });
    }
  }
  
  if (error.message === 'Seuls les fichiers image sont autorisés!') {
    return res.status(400).json({
      message: error.message
    });
  }
  
  next(error);
};

export { upload, handleMulterError };