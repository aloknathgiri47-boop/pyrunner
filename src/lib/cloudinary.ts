/**
 * Cloudinary configuration and helper functions.
 *
 * Used for:
 * - Uploading user project screenshots/preview images
 * - Storing uploaded code snippets as images
 * - Serving project thumbnails
 * - Profile pictures (when auth is added)
 */
import { v2 as cloudinary } from 'cloudinary'

// Configure Cloudinary from environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export { cloudinary }

/**
 * Upload a file (Buffer or base64 string) to Cloudinary.
 * Returns the secure URL.
 */
export async function uploadToCloudinary(
  data: Buffer | string,
  options: {
    folder?: string
    public_id?: string
    resource_type?: 'image' | 'raw' | 'video' | 'auto'
  } = {}
): Promise<{ url: string; public_id: string }> {
  const result = await cloudinary.uploader.upload(data, {
    folder: options.folder || 'pyrunner',
    public_id: options.public_id,
    resource_type: options.resource_type || 'auto',
  })
  return {
    url: result.secure_url,
    public_id: result.public_id,
  }
}

/**
 * Delete a file from Cloudinary by its public_id.
 */
export async function deleteFromCloudinary(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId)
}

/**
 * Generate a signed upload widget signature for client-side uploads.
 * Used when users upload files directly from the browser.
 */
export function generateUploadSignature(folder: string = 'pyrunner') {
  const timestamp = Math.round(new Date().getTime() / 1000)
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder },
    process.env.CLOUDINARY_API_SECRET!
  )
  return {
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    folder,
  }
}
