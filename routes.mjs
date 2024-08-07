import express from "express";
import { UserPosts, db } from "./config.mjs";
import { createImage, uploadImage } from "./imageGenerator.mjs";
import {
  getDocs,
  query,
  orderBy,
  setDoc,
  doc,
  getDoc,
} from "firebase/firestore";
import crypto from "crypto";
import mime from "mime-types";

const router = express.Router();

router.get("/api/posts", async (req, res) => {
  try {
    const postsQuery = query(UserPosts, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(postsQuery);
    const posts = querySnapshot.docs.map((doc) => doc.data());

    res.json(posts);
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

router.post("/api/posts", async (req, res) => {
  try {
    const { title, content, image } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: "Title and content are required" });
    }

    const postId = crypto.randomUUID();
    const ogImage = await createImage(title, content);

    const ogImageBuffer = await ogImage.png().toBuffer();
    const ogImageUrl = await uploadImage(
      ogImageBuffer,
      `og-images/${postId}.png`,
      "image/png"
    );

    let imageUrl = null;
    if (image) {
      const imageBuffer = Buffer.from(image.split(",")[1], "base64");
      const mimeType = image.split(";")[0].split(":")[1];
      const fileExtension = mime.extension(mimeType);

      if (!fileExtension) {
        return res.status(400).json({ error: "Unsupported image type" });
      }

      imageUrl = await uploadImage(
        imageBuffer,
        `images/${postId}.${fileExtension}`,
        mimeType
      );
    }

    const post = {
      id: postId,
      title,
      content,
      image: imageUrl,
      ogImage: ogImageUrl,
      createdAt: new Date().toISOString(),
    };

    const postRef = doc(UserPosts, postId);
    await setDoc(postRef, post);

    res.status(201).json(post);
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ error: "Failed to create post" });
  }
});

router.get("/api/posts/:id", async (req, res) => {
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

router.get("/og-image/:id", async (req, res) => {
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
  } catch (error) {
    console.error("Error generating OG image:", error);
    res.status(500).send("Failed to generate OG image");
  }
});

export default router;
