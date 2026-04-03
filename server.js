import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFile } from "fs/promises";

const app = express();
app.use(express.json());

// 🔒 Fix __dirname (ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🔒 SAFE BASE DIRECTORY
const BASE_DIR = path.join(__dirname, "safe-files");

// MCP Server
const server = new Server(
    {
        name: "my-first-mcp",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// 📦 Tool list
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "read_file",
                description: "Read a file from safe directory only",
                inputSchema: {
                    type: "object",
                    properties: {
                        path: { type: "string" },
                    },
                    required: ["path"],
                },
            },
        ],
    };
});

// 🔒 Secure path resolver
function getSafePath(userPath) {
    const resolvedPath = path.resolve(BASE_DIR, userPath);

    if (!resolvedPath.startsWith(BASE_DIR)) {
        throw new Error("Access denied");
    }

    return resolvedPath;
}

// 📦 Tool handler
server.setRequestHandler(CallToolRequestSchema, async (req) => {
    try {
        const { name, arguments: args } = req.params;

        if (name === "read_file") {
            const safePath = getSafePath(args.path);
            const content = await readFile(safePath, "utf-8");

            return {
                content: [{ type: "text", text: content }],
            };
        }

        return {
            content: [{ type: "text", text: "Unknown tool" }],
        };
    } catch (err) {
        return {
            content: [
                {
                    type: "text",
                    text: `Error: ${err.message}`,
                },
            ],
        };
    }
});

// 🌐 MCP endpoint
app.post("/mcp", async (req, res) => {
    try {
        const response = await server.handleRequest(req.body);
        res.json(response);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 🟢 Health check endpoint (NEW)
app.get("/healthz", (req, res) => {
    res.status(200).send("OK");
});

// root endpoint
app.get("/", (req, res) => {
    res.send("MCP Server Running");
});

// start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});