import express from "express";
import sharp from "sharp";
import path from "path";
import cors from "cors";
import prerender from "prerender-node";
import { promises as fs } from "fs";
import crypto from "crypto";
import mime from "mime-types";

import { UserPosts, db, storage } from "./config.mjs";
import {
  getDocs,
  query,
  orderBy,
  setDoc,
  doc,
  getDoc,
} from "firebase/firestore";

import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

const app = express();
const port = 3001;

app.use(
  cors({
    origin: [
      "https://eclectic-seahorse-90cb3b.netlify.app",
      "https://main--eclectic-seahorse-90cb3b.netlify.app",
      "http://localhost:5173",
      "http://localhost:8888",
      "http://localhost:3000",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:3000",
      "https://*.netlify.app",
      "https://*.netlify.com",
    ],
  })
);

app.use(prerender.set("prerenderToken", "qdz69MpyDhjUp4yciM1t"));
app.use(express.static("build"));

// Increase payload size limit to 50MB (adjust as needed)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

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

// Usage
async function createImage(title, content) {
  const width = 1200;
  const height = 630;
  try {
    const buffer = await generateOgImage(title, content, height, width);
    await sharp(buffer).toFile("output.png");
    console.log("Image generated successfully");
    let i = sharp(buffer);

    // Add branding (logo)
    const logo = await sharp(path.join(__dirname, "assets", "logo.png"))
      .resize(100, 100, { fit: "inside" })
      .toBuffer();
    i = i.composite([{ input: logo, top: height - 120, left: width - 120 }]);
    return i;
  } catch (error) {
    console.error("Error generating image:", error);
  }
}

app.get("/", function (req, res) {
  res.send("Hello World!");
});

app.get("/api/posts", async (req, res) => {
  try {
    // Create a query to get posts sorted by creation date
    const postsQuery = query(UserPosts, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(postsQuery);
    const posts = querySnapshot.docs.map((doc) => doc.data());

    // const posts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    res.json(posts);
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

// const outputDir = path.join(__dirname, "public", "og-images");
// fs.mkdir(outputDir, { recursive: true }).catch(console.error);
app.post("/generate-og-image", async (req, res) => {
  res.json({ imageUrl: `` });
  // try {
  //   const { title, content, imageUrl } = req.body;
  //   if (!title || !content) {
  //     return res.status(400).json({ error: "Title and content are required" });
  //   }

  //   const image = await generateOgImage(title, content, imageUrl);
  //   const fileName = `og-${Date.now()}.png`;
  //   const filePath = path.join(outputDir, fileName);

  //   await image.toFile(filePath);

  //   res.json({ imageUrl: `/og-images/${fileName}` });
  // } catch (error) {
  //   console.error("Error generating OG image:", error);
  //   res.status(500).json({ error: "Failed to generate OG image" });
  // }
});

app.post("/api/posts", async (req, res) => {
  try {
    const { title, content, image } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: "Title and content are required" });
    }

    const postId = crypto.randomUUID();
    const ogImage = await createImage(title, content);

    const ogImageBuffer = await ogImage.png().toBuffer();
    const ogImageRef = ref(storage, `og-images/${postId}.png`);
    await uploadBytesResumable(ogImageRef, ogImageBuffer, {
      contentType: "image/png",
    });
    const ogImageUrl = await getDownloadURL(ogImageRef);

    let imageUrl = null;
    if (image) {
      const imageBuffer = Buffer.from(image.split(",")[1], "base64");

      const mimeType = image.split(";")[0].split(":")[1];
      const fileExtension = mime.extension(mimeType);
      console.log("fileee...........", fileExtension, mimeType);

      if (!fileExtension) {
        return res.status(400).json({ error: "Unsupported image type" });
      }

      const imageRef = ref(storage, `images/${postId}.${fileExtension}`);
      const metadata = {
        contentType: mimeType,
      };
      const uploadTask = uploadBytesResumable(imageRef, imageBuffer, metadata);

      await uploadTask
        .then((snapshot) => {
          return getDownloadURL(snapshot.ref);
        })
        .then((url) => {
          imageUrl = url;
        })
        .catch((error) => {
          throw error;
        });

      // await uploadBytes(imageRef, imageBuffer);
      // imageUrl = await getDownloadURL(imageRef);
    }

    // let imageFileName = null;
    // if (image) {
    //   const imageBuffer = Buffer.from(image.split(",")[1], "base64");
    //   imageFileName = `image-${postId}.png`;
    //   const imagePath = path.join(outputDir, imageFileName);
    //   await fs.writeFile(imagePath, imageBuffer);
    // }

    const post = {
      id: postId,
      title,
      content,
      image: imageUrl,
      ogImage: ogImageUrl,
      createdAt: new Date().toISOString(),
    };

    // await addDoc(UserPosts, post);
    const postRef = doc(UserPosts, postId);
    await setDoc(postRef, post);

    // await fs.writeFile(
    //   path.join(postsDir, `${postId}.json`),
    //   JSON.stringify(post)
    // );

    res.status(201).json(post);
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ error: "Failed to create post" });
  }
});

app.get("/og-image/:id", async (req, res) => {
  try {
    const postId = req.params.id;

    const postRef = doc(UserPosts, postId);
    const postSnap = await getDoc(postRef);

    if (postSnap.exists()) {
      const post = postSnap.data();
      const image = await createImage(post.title, post.content);
      res.set("Content-Type", "image/png");
      image.pipe(res);
    } else {
      res.status(404).json({ error: "Image not found" });
    }

    // const postPath = path.join(postsDir, `${postId}.json`);
    // const postData = await fs.readFile(postPath, "utf-8");
    // const post = JSON.parse(postData);
  } catch (error) {
    console.error("Error generating OG image:", error);
    res.status(500).send("Failed to generate OG image");
  }
});

app.get("/api/posts/:id", async (req, res) => {
  try {
    const postId = req.params.id;
    const postRef = doc(UserPosts, postId);
    const postSnap = await getDoc(postRef);

    if (postSnap.exists()) {
      const post = postSnap.data();
      res.json(post);
    } else {
      res.status(404).json({ error: "Post not found" });
    }
  } catch (error) {
    console.error("Error fetching post:", error);
    res.status(500).json({ error: "Failed to fetch post" });
  }
});

app.use(
  "/og-images",
  express.static(path.join(__dirname, "public", "og-images"))
);

app.listen(port, function () {
  console.log(`Example app listening on port ${port}!`);
});
