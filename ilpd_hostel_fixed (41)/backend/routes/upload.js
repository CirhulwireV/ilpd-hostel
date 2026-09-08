const express = require('express');
const router = express.Router();
const cloudinary = require('../config/cloudinary');
const upload = require('../middleware/upload');

// ✅ SIMPLE AUTH - Bypass for testing
const auth = (req, res, next) => {
  console.log('🔓 Auth bypassed for testing');
  next();
};

// ✅ Upload room images
router.post('/rooms/images', auth, upload.array('images', 5), async (req, res) => {
  console.log('📸 Upload request received');
  console.log('Files:', req.files ? req.files.length : 0);
  
  try {
    if (!req.files || req.files.length === 0) {
      console.log('❌ No files received');
      return res.status(400).json({ error: 'Please upload at least one image' });
    }

    const uploadedUrls = [];

    for (const file of req.files) {
      console.log(`📤 Uploading: ${file.originalname} (${file.size} bytes)`);
      
      // Convert buffer to base64
      const b64 = Buffer.from(file.buffer).toString('base64');
      const dataURI = `data:${file.mimetype};base64,${b64}`;

      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload(dataURI, {
        folder: 'hostel/rooms',
        transformation: [
          { width: 1200, height: 900, crop: 'limit' },
          { quality: 'auto' },
          { fetch_format: 'auto' }
        ]
      });

      console.log(`✅ Uploaded: ${result.secure_url}`);
      uploadedUrls.push(result.secure_url);
    }

    res.json({ images: uploadedUrls });
  } catch (error) {
    console.error('❌ Upload error:', error.message);
    res.status(500).json({ error: error.message || 'Upload failed' });
  }
});

// ✅ Upload single image
router.post('/single', auth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload an image' });
    }

    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;

    const result = await cloudinary.uploader.upload(dataURI, {
      folder: 'hostel/uploads',
      transformation: [
        { width: 1920, height: 1080, crop: 'limit' },
        { quality: 'auto' },
        { fetch_format: 'auto' }
      ]
    });

    res.json({ url: result.secure_url });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message || 'Upload failed' });
  }
});

// ✅ Delete image
router.delete('/delete', auth, async (req, res) => {
  try {
    const { publicId } = req.body;
    if (!publicId) {
      return res.status(400).json({ error: 'Public ID is required' });
    }

    const result = await cloudinary.uploader.destroy(publicId);
    res.json({ message: 'Image deleted successfully', result });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message || 'Delete failed' });
  }
});

module.exports = router;