import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

const requestedRoot = process.argv[2] ?? ".";
const port = Number.parseInt(process.argv[3] ?? process.env.PORT ?? "5173", 10);
const root = path.resolve(process.cwd(), requestedRoot);
const rootWithSeparator = root.endsWith(path.sep) ? root : `${root}${path.sep}`;

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
]);

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    const pathname = decodeURIComponent(requestUrl.pathname);
    let filePath = path.resolve(root, `.${pathname}`);

    if (filePath !== root && !filePath.startsWith(rootWithSeparator)) {
      response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }

    const fileStat = await stat(filePath).catch(() => null);
    if (fileStat?.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    const resolvedStat = await stat(filePath).catch(() => null);
    if (!resolvedStat?.isFile()) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "content-type": contentTypes.get(path.extname(filePath)) ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    createReadStream(filePath).pipe(response);
  } catch (error) {
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    response.end(error instanceof Error ? error.message : String(error));
  }
});

server.listen(port, () => {
  const rootLabel = path.relative(process.cwd(), root) || ".";
  console.log(`Serving ${rootLabel} at http://localhost:${port}/`);
});

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});
