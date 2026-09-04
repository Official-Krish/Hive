import { serve } from "bun";
import index from "./index.html";

const server = serve({
  port: 5173,
  routes: {
    // Serve static assets from public/
    "/avatars/*": async (req) => {
      const url = new URL(req.url);
      const filePath = url.pathname.slice(1);
      const file = Bun.file(`./public/${filePath}`);
      if (await file.exists()) {
        return new Response(file);
      }
      return new Response("Not found", { status: 404 });
    },

    "/Animations/*": async (req) => {
      const url = new URL(req.url);
      const filePath = url.pathname.slice(1);
      const file = Bun.file(`./public/${filePath}`);
      if (await file.exists()) {
        return new Response(file);
      }
      return new Response("Not found", { status: 404 });
    },

    // Scroll-engine script (vanilla JS, not bundled — served as a plain file)
    "/scrub-engine.js": async () => {
      const file = Bun.file("./public/scrub-engine.js");
      return new Response(file, {
        headers: { "Content-Type": "application/javascript" },
      });
    },

    // SEO: robots + sitemap
    "/robots.txt": async () => {
      const file = Bun.file("./public/robots.txt");
      return new Response(file, {
        headers: { "Content-Type": "text/plain" },
      });
    },
    "/sitemap.xml": async () => {
      const file = Bun.file("./public/sitemap.xml");
      return new Response(file, {
        headers: { "Content-Type": "application/xml" },
      });
    },

    // Scene still images
    "/skills/*": async (req) => {
      const url = new URL(req.url);
      const filePath = url.pathname.slice(1);
      const file = Bun.file(`./public/${filePath}`);
      if (await file.exists()) {
        return new Response(file);
      }
      return new Response("Not found", { status: 404 });
    },

    // Cinematic video legs
    "/vid/*": async (req) => {
      const url = new URL(req.url);
      const filePath = url.pathname.slice(1);
      const file = Bun.file(`./public/${filePath}`);
      if (await file.exists()) {
        return new Response(file, {
          headers: {
            "Content-Type": "video/mp4",
            "Accept-Ranges": "bytes",
          },
        });
      }
      return new Response("Not found", { status: 404 });
    },

    // Serve index.html for all unmatched routes.
    "/*": index,

    "/api/hello": {
      async GET() {
        return Response.json({
          message: "Hello, world!",
          method: "GET",
        });
      },
      async PUT() {
        return Response.json({
          message: "Hello, world!",
          method: "PUT",
        });
      },
    },

    "/api/hello/:name": async (req) => {
      const name = req.params.name;
      return Response.json({
        message: `Hello, ${name}!`,
      });
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`Server running at ${server.url}`);
