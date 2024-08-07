import express from "express";
import cors from "cors";
import prerender from "prerender-node";
import routes from "./routes.mjs";

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
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use("/", routes);

app.listen(port, function () {
  console.log(`Example app listening on port ${port}!`);
});
