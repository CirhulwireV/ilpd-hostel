const crypto = require("crypto");
const { PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");

const requiredSettings = ["AWS_S3_BUCKET", "AWS_REGION", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"];
const getMissingSettings = () => requiredSettings.filter((name) => !process.env[name]);

const getClient = () => new S3Client({
  region: process.env.AWS_REGION,
  credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY },
});

const getPublicUrl = (key) => {
  const cdnUrl = (process.env.CLOUDFRONT_URL || "").replace(/\/$/, "");
  if (cdnUrl) return `${cdnUrl}/${key}`;
  const host = process.env.AWS_REGION === "us-east-1"
    ? `${process.env.AWS_S3_BUCKET}.s3.amazonaws.com`
    : `${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`;
  return `https://${host}/${key}`;
};

const uploadRoomImage = async (file) => {
  const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[file.mimetype];
  if (!extension) throw new Error("Only JPG, PNG, and WebP images are supported.");
  const key = `room-images/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
  await getClient().send(new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
    CacheControl: "public, max-age=31536000, immutable",
  }));
  return getPublicUrl(key);
};

module.exports = { getMissingSettings, uploadRoomImage };
