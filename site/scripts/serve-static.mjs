import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const root = resolve("out");
const host = "127.0.0.1";
const port = Number(process.env.CHRSM_PREVIEW_PORT || 3000);
const pagesPrefix = "/chrsm-voicebot-demo";

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

function getRelativePath(requestUrl) {
  const url = new URL(requestUrl || "/", `http://${host}:${port}`);
  const decodedPath = decodeURIComponent(url.pathname);
  const unprefixed = decodedPath === pagesPrefix
    ? "/"
    : decodedPath.startsWith(`${pagesPrefix}/`)
      ? decodedPath.slice(pagesPrefix.length)
      : decodedPath;
  return unprefixed.replace(/^\/+/, "") || "index.html";
}

async function resolveFile(relativePath) {
  let filePath = resolve(root, relativePath);
  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) return null;

  try {
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) filePath = resolve(filePath, "index.html");
    await stat(filePath);
    return filePath;
  } catch {
    const fallback = resolve(root, "404.html");
    try {
      await stat(fallback);
      return fallback;
    } catch {
      return null;
    }
  }
}

createServer(async (request, response) => {
  try {
    const filePath = await resolveFile(getRelativePath(request.url));
    if (!filePath) {
      response.writeHead(404).end("Not found");
      return;
    }
    const body = await readFile(filePath);
    response.writeHead(filePath.endsWith("404.html") ? 404 : 200, {
      "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream",
      "Cache-Control": filePath.endsWith(".html") ? "no-cache" : "public, max-age=3600",
    });
    response.end(body);
  } catch {
    response.writeHead(500).end("Preview server error");
  }
}).listen(port, host, () => {
  console.log(`Static preview: http://${host}:${port}`);
});
