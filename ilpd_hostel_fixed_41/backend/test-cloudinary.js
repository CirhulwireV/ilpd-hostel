const cloudinary = require('./config/cloudinary');
require('dotenv').config();

const testUpload = async () => {
  try {
    console.log('📸 Testing Cloudinary upload...');
    
    // Upload a small test image (placeholder)
    const result = await cloudinary.uploader.upload(
      'https://via.placeholder.com/100x100.png',
      { folder: 'test' }
    );
    
    console.log('✅ Cloudinary upload successful!');
    console.log('📷 URL:', result.secure_url);
  } catch (error) {
    console.error('❌ Cloudinary upload failed:', error.message);
  }
};

testUpload();