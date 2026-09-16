// Serves the production build under a non-root path, the way GitHub Pages
// serves a project site, so browser tests catch asset URLs that only work at "/".
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type ServerResponse } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const BASE_PATH = "/original-source-procurement/";

const port = Number(process.env.PORT ?? "4173");
// OSP_DIST names another build directory beside dist, such as the fixtures build.
const distDir = resolve(
  fileURLToPath(
    new URL(`../${process.env.OSP_DIST ?? "dist"}`, import.meta.url),
  ),
);

const contentTypes: Readonly<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function send(response: ServerResponse, status: number, body: string): void {
  response.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  response.end(body);
}

async function handle(url: string, response: ServerResponse): Promise<void> {
  const { pathname } = new URL(url, "http://localhost");

  if (pathname === BASE_PATH.slice(0, -1)) {
    response.writeHead(301, { location: BASE_PATH });
    response.end();
    return;
  }

  if (!pathname.startsWith(BASE_PATH)) {
    send(response, 404, "Not found");
    return;
  }

  let relativePath: string;
  try {
    relativePath = decodeURIComponent(pathname.slice(BASE_PATH.length));
  } catch {
    send(response, 400, "Bad request");
    return;
  }

  const filePath = normalize(join(distDir, relativePath || "index.html"));

  if (!filePath.startsWith(distDir + sep)) {
    send(response, 404, "Not found");
    return;
  }

  try {
    if (!(await stat(filePath)).isFile()) {
      send(response, 404, "Not found");
      return;
    }
  } catch {
    send(response, 404, "Not found");
    return;
  }

  response.writeHead(200, {
    "content-type":
      contentTypes[extname(filePath)] ?? "application/octet-stream",
  });
  createReadStream(filePath).pipe(response);
}

createServer((request, response) => {
  void handle(request.url ?? "/", response);
}).listen(port, "127.0.0.1", () => {
  console.log(
    `Serving ${distDir} at http://127.0.0.1:${String(port)}${BASE_PATH}`,
  );
});
