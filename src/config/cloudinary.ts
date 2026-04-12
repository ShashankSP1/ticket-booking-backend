import { v2 as cloudinary } from "cloudinary";

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

const isCloudinaryConfigured = Boolean(cloudName && apiKey && apiSecret);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: cloudName as string,
    api_key: apiKey as string,
    api_secret: apiSecret as string,
  });
}

export const uploadReceiptToCloudinary = async (filePath: string) => {
  if (!isCloudinaryConfigured) {
    return null;
  }

  const uploaded = await cloudinary.uploader.upload(filePath, {
    folder: "wallet-receipts",
    resource_type: "image",
  });

  return {
    url: uploaded.secure_url,
    publicId: uploaded.public_id,
  };
};

export const cloudinaryEnabled = isCloudinaryConfigured;
