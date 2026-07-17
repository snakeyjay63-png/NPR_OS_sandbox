// @addr 10.07.x.x
// OpenClaw State Client — optional noise source
// Fetches gateway state from port 18789. Downtime = missing evidence, not failure.

const https = require("https");
const http = require("http");

const OPENCLAW_BASE_URL =
    process.env.OPENCLAW_BASE_URL || "http://127.0.0.1:18789";

/**
 * Fetch OpenClaw gateway status.
 * @returns {{available: boolean, data?: any, error?: string, status_hex?: string}}
 */
function getOpenClawState() {
    return new Promise((resolve) => {
        try {
            const url = new URL("/status", OPENCLAW_BASE_URL);
            const client = url.protocol === "https:" ? https : http;

            const req = client.get(
                {
                    hostname: url.hostname,
                    port: url.port,
                    path: url.pathname + url.search,
                    headers: { "User-Agent": "npr-local/1.0" },
                },
                (res) => {
                    let body = "";
                    res.on("data", (chunk) => (body += chunk));
                    res.on("end", () => {
                        try {
                            const data = JSON.parse(body);
                            resolve({ available: true, data });
                        } catch {
                            resolve({
                                available: true,
                                data: body,
                            });
                        }
                    });
                },
            );

            req.on("error", (err) => {
                resolve({
                    available: false,
                    error: err.message,
                    status_hex: "0x0000",
                });
            });

            // @addr 10.07.D0 — 0x07D0 = 2000 ms timeout
            req.timeout = 0x07D0;
            req.on("timeout", () => {
                req.destroy();
                resolve({
                    available: false,
                    error: "timeout",
                    status_hex: "0x07D0",
                });
            });
        } catch (err) {
            // Never throw — OpenClaw downtime is just missing noise evidence
            resolve({
                available: false,
                error: err.message,
                status_hex: "0xFFFF",
            });
        }
    });
}

module.exports = {
    OPENCLAW_BASE_URL,
    getOpenClawState,
};
