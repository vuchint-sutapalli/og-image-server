// var express = require("express");
// var app = express();
// const sharp = require("sharp");
const express = require("express");
const sharp = require("sharp");
const path = require("path");
const cors = require("cors");

const fs = require("fs").promises;
const crypto = require("crypto");

const app = express();
const port = 3000;

// app.use(
//   cors({
//     origin: "http://localhost:5173", // Allow requests from your React app
//   })
// );

app.use(
  cors({
    origin: "https://og-image-254bv81c2-vuchint-sutapallis-projects.vercel.app", // Allow requests from your React app
  })
);

// Increase payload size limit to 50MB (adjust as needed)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// app.use(express.json());
const outputDir = path.join(__dirname, "public", "og-images");
const postsDir = path.join(__dirname, "data", "posts");

// Ensure the output directory exists
// const outputDir = path.join(__dirname, "public", "og-images");
fs.mkdir(outputDir, { recursive: true }).catch(console.error);
fs.mkdir(postsDir, { recursive: true }).catch(console.error);

async function generateOgImage(title, content, imageUrl) {
  const width = 1200;
  const height = 630;

  // Start with a blank canvas
  let image = sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  });

  // Add a gradient background
  //   const gradientBuffer = await sharp({
  //     create: {
  //       width,
  //       height,
  //       channels: 4,
  //       background: { r: 0, g: 0, b: 0, alpha: 0 },
  //     },
  //   })
  //     .linear(1, 0.5)
  //     .gradient({
  //       type: "linear",
  //       colorspace: "lab",
  //       colors: ["#4a90e2", "#50E3C2"],
  //     })
  //     .toBuffer();

  //   image = image.composite([{ input: gradientBuffer }]);

  // Add the title
  const titleSvg = `
      <svg width="${width}" height="${height}">
        <style>
          .title { fill: #ffffff; font-size: 60px; font-weight: bold; font-family: Arial, sans-serif; }
        </style>
        <text x="50" y="100" class="title">${title}</text>
      </svg>
    `;
  image = image.composite([{ input: Buffer.from(titleSvg), top: 0, left: 0 }]);

  // Add the content snippet
  const contentSnippet =
    content.length > 100 ? content.substring(0, 97) + "..." : content;
  const contentSvg = `
      <svg width="${width}" height="${height}">
        <style>
          .content { fill: #ffffff; font-size: 30px; font-family: Arial, sans-serif; }
        </style>
        <text x="50" y="200" class="content">${contentSnippet}</text>
      </svg>
    `;
  image = image.composite([
    { input: Buffer.from(contentSvg), top: 0, left: 0 },
  ]);

  // Add the image if provided
  //   if (imageUrl) {
  //     const userImage = await sharp(imageUrl)
  //       .resize(400, 400, { fit: "inside" })
  //       .toBuffer();
  //     image = image.composite([{ input: userImage, top: 220, left: 50 }]);
  //   }

  // Add branding (logo)
  const logo = await sharp(path.join(__dirname, "assets", "logo.png"))
    .resize(100, 100, { fit: "inside" })
    .toBuffer();
  image = image.composite([
    { input: logo, top: height - 120, left: width - 120 },
  ]);

  return image;
}

app.get("/", function (req, res) {
  res.send("Hello World!");
});

app.post("/generate-og-image", async (req, res) => {
  try {
    const { title, content, imageUrl } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: "Title and content are required" });
    }

    const image = await generateOgImage(title, content, imageUrl);
    const fileName = `og-${Date.now()}.png`;
    const filePath = path.join(outputDir, fileName);

    await image.toFile(filePath);

    res.json({ imageUrl: `/og-images/${fileName}` });
  } catch (error) {
    console.error("Error generating OG image:", error);
    res.status(500).json({ error: "Failed to generate OG image" });
  }
});

app.post("/api/posts", async (req, res) => {
  try {
    const { title, content, image } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: "Title and content are required" });
    }

    const postId = crypto.randomUUID();
    const ogImage = await generateOgImage(title, content);
    const ogImageFileName = `og-${postId}.png`;
    const ogImagePath = path.join(outputDir, ogImageFileName);

    await ogImage.toFile(ogImagePath);

    let imageFileName = null;
    if (image) {
      const imageBuffer = Buffer.from(image.split(",")[1], "base64");
      imageFileName = `image-${postId}.png`;
      const imagePath = path.join(outputDir, imageFileName);
      await fs.writeFile(imagePath, imageBuffer);
    }

    const post = {
      id: postId,
      title,
      content,
      image: imageFileName ? `/og-images/${imageFileName}` : null,
      ogImage: `/og-images/${ogImageFileName}`,
      createdAt: new Date().toISOString(),
    };

    await fs.writeFile(
      path.join(postsDir, `${postId}.json`),
      JSON.stringify(post)
    );

    res.status(201).json(post);
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ error: "Failed to create post" });
  }
});

app.get("/api/posts/:id", async (req, res) => {
  try {
    const postId = req.params.id;
    const postPath = path.join(postsDir, `${postId}.json`);

    const postData = await fs.readFile(postPath, "utf-8");
    const post = JSON.parse(postData);

    res.json(post);
  } catch (error) {
    console.error("Error fetching post:", error);
    res.status(404).json({ error: "Post not found" });
  }
});

app.use(
  "/og-images",
  express.static(path.join(__dirname, "public", "og-images"))
);

// app.get("/generate-og-image", function (req, res) {
//   sharp({
//     create: {
//       width: 48,
//       height: 48,
//       channels: 4,
//       background: { r: 255, g: 0, b: 0, alpha: 0.5 },
//     },
//   })
//     .png()
//     .toBuffer()
//     .then((data) => {
//       console.log(data);
//     })
//     .catch((err) => {});
//   res.send("generating!");
// });

app.listen(3000, function () {
  console.log("Example app listening on port 3000!");
});
