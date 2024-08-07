import sharp from "sharp";
import path from "path";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "./config.mjs";

const __dirname = path.resolve();

async function generateOgImage(title, content, height, width) {
  const svgImage = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:rgb(74,144,226);stop-opacity:1" />
          <stop offset="100%" style="stop-color:rgb(80,227,194);stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad)" />
      <text x="50" y="100" font-family="Arial, sans-serif" font-size="60" font-weight="bold" fill="white">${title}</text>
      <text x="50" y="200" font-family="Arial, sans-serif" font-size="30" fill="white">${content}</text>
    </svg>
  `;

  return sharp(Buffer.from(svgImage)).png().toBuffer();
}

async function createImage(title, content) {
  const width = 1200;
  const height = 630;
  try {
    const buffer = await generateOgImage(title, content, height, width);
    let image = sharp(buffer);

    const logo = await sharp(path.join(__dirname, "assets", "logo.png"))
      .resize(100, 100, { fit: "inside" })
      .toBuffer();
    image = image.composite([
      { input: logo, top: height - 120, left: width - 120 },
    ]);

    return image;
  } catch (error) {
    console.error("Error generating image:", error);
  }
}

async function uploadImage(buffer, filePath, contentType) {
  const imageRef = ref(storage, filePath);
  const uploadTask = uploadBytesResumable(imageRef, buffer, { contentType });
  await uploadTask;

  return getDownloadURL(imageRef);
}

export { createImage, uploadImage };
