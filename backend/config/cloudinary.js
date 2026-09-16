
const cloudinary = require('cloudinary').v2;

console.log('📋 Checking Cloudinary credentials...');
console.log('CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME || '❌ NOT FOUND');
console.log('API_KEY:', process.env.CLOUDINARY_API_KEY ? '✅ Found' : '❌ NOT FOUND');
console.log('API_SECRET:', process.env.CLOUDINARY_API_SECRET ? '✅ Found' : '❌ NOT FOUND');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log('✅ Cloudinary configured');

module.exports = cloudinary;
