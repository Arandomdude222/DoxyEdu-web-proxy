import { createServer } from "node:http";
import { fileURLToPath } from "url";
import { hostname } from "node:os";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { spawn } from "child_process";

import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";

const publicPath = fileURLToPath(new URL("../public/", import.meta.url));

// --- Start Python Wisp ---
const pythonWisp = spawn("python3", ["-m", "wisp.server", "--host", "127.0.0.1", "--port", "9090", "--threads", "6"], {
  stdio: ["ignore", "pipe", "pipe"], // keep only errors/info
});

pythonWisp.stdout.on("data", (data) => {
  // Suppress INFO logs unless they are errors
  const msg = data.toString();
  if (!msg.includes("INFO")) return;
  // Uncomment next line if you want verbose logs
  // console.log(`[Python Wisp] ${msg.trim()}`);
});

pythonWisp.stderr.on("data", (data) => {
  console.error(`[Python Wisp ERROR] ${data.toString().trim()}`);
});

pythonWisp.on("exit", (code) => {
  console.log(`[Python Wisp] exited with code ${code}`);
});

// --- Configure Wisp options for production CurlTransport ---
logging.set_level(logging.NONE);

Object.assign(wisp.options, {
  transport: "curl",                    // production transport
  curl_host: "http://127.0.0.1:9090",  // python Wisp
  encrypted: true,
  allow_udp_streams: true,
  hostname_blacklist: [/example\.com/],
  dns_servers: ["1.1.1.3", "1.0.0.3"],
});

// --- Fastify server ---
const fastify = Fastify({
  serverFactory: (handler) => {
    return createServer()
      .on("request", (req, res) => {
        res.setHeader("Cross-Origin-Opener-Policy", "same-origin"); // COEP
        res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
        handler(req, res);
      })
      .on("upgrade", (req, socket, head) => {
        try {
          if (req.url.startsWith("/wisp/")) {
            wisp.routeRequest(req, socket, head);
          } else {
            socket.end();
          }
        } catch (err) {
          console.error("[Wisp Upgrade Error]", err);
          socket.end();
        }
      });
  },
});

// --- Serve static files ---
fastify.register(fastifyStatic, { root: publicPath, decorateReply: true });
fastify.register(fastifyStatic, { root: scramjetPath, prefix: "/scram/", decorateReply: false });
fastify.register(fastifyStatic, { root: epoxyPath, prefix: "/epoxy/", decorateReply: false });
fastify.register(fastifyStatic, { root: baremuxPath, prefix: "/baremux/", decorateReply: false });

// 404 handler
fastify.setNotFoundHandler((req, reply) => {
  return reply.code(404).type('text/html').sendFile('404.html');
});

function shutdown() {
  console.log("Shutting down DoxyEdu Web Proxy...");
  pythonWisp.kill();
  fastify.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// --- Start server ---
let port = parseInt(process.env.PORT || "");
if (isNaN(port)) port = 8080;

fastify.listen({
  port: port,
  host: "0.0.0.0",
}, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log("Listening on:");
  console.log(`\thttp://localhost:${port}`);
  console.log(`\thttp://${hostname()}:${port}`);
});
