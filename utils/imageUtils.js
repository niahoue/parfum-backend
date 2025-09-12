// src/utils/imageUtils.js
const CLOUDINARY_CLOUD_NAME = 'dyqld28ez'; 
const UPLOAD_PRESET = 'fragrance_de_mumu';

export const getImageUrl = (publicId, options = {}) => {
  if (!publicId) {
    return 'https://via.placeholder.com/1920x1080.png?text=No+Image';
  }

  const base_url = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/`;
  const transformation_parts = [];

  // Add transformations from options
  if (options.width) transformation_parts.push(`w_${options.width}`);
  if (options.height) transformation_parts.push(`h_${options.height}`);
  if (options.crop) transformation_parts.push(`c_${options.crop}`);
  if (options.quality) transformation_parts.push(`q_${options.quality}`);
  if (options.format) transformation_parts.push(`f_${options.format}`);

  // Construct transformation string
  const transformation_string = transformation_parts.join(',');

  // Check if publicId is a full URL or just the public ID
  const isFullUrl = publicId.startsWith('http://') || publicId.startsWith('https://');
  let finalUrl;

  if (isFullUrl) {
    const match = publicId.match(/v\d+\/(.*)\.\w+$/);
    const id = match ? match[1] : publicId;
    finalUrl = `${base_url}${transformation_string ? `${transformation_string}/` : ''}${id}`;
  } else {
    finalUrl = `${base_url}${transformation_string ? `${transformation_string}/` : ''}${publicId}`;
  }

  return finalUrl;
};


export { CLOUDINARY_CLOUD_NAME, UPLOAD_PRESET };