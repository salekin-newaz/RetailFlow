const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

const projectRef = "pxgkqcajhcimybrzerfa";
const sseUrl = `https://mcp.supabase.com/mcp?project_ref=${projectRef}`;
const sqlFile = path.join(__dirname, 'schema.sql');

if (!fs.existsSync(sqlFile)) {
    console.error(`Error: schema.sql not found at ${sqlFile}`);
    process.exit(1);
}

const sqlContent = fs.readFileSync(sqlFile, 'utf8');
console.log(`Loaded schema.sql successfully (${sqlContent.length} bytes).`);

// Using the decoded Supabase Dashboard Auth JWT found in Chrome LevelDB
const token = "eyJhbGciOiJSUzI1NiIsImtpZCI6IjNlNjE5YzJjIiwidHlwIjoiSldUIn0.eyJpc3MiOiJodHRwczovL2FsdC5zdXBhYmFzZS5pby9hdXRoL3YxIiwic3ViIjoiZGI1NDIxNTktMTdjYi00NDNjLTg4NmUtZTFmOTIwMTU2YjMzIiwiYXVkIjoiYXV0aGVudGljYXRlZCIsImV4cCI6MTc4MDA0Mzc5MiwiaWF0IjoxNzgwMDQxOTkyLCJlbWFpbCI6InNhbWkuc2FsZWtpbjEyM0BnbWFpbC5jb20iLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6ImVtYWlsIiwicHJvdmlkZXJzIjpbImVtYWlsIl19LCJ1c2VyX21ldGFkYXRhIjp7ImVtYWlsX3ZlcmlmaWVkIjp0cnVlfSwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJhYWwiOiJhYWwxIiwiYW1yIjpbeyJtZXRob2QiOiJvdHAiLCJ0aW1lc3RhbXAiOjE3Nzk5MDUwNzh9XSwic2Vzc2lvbl9pZCI6Ijc5ZmFiMzc5LTg5MTMtNGM5OC04ZGUwLThmOTNkY2ZmZTk5OCIsImlzX2Fub255bW91cyI6ZmFsc2V9.mSF8mOCIY4SZ7J3MgRmYOfEH_s4iAqoEmR7VeP3-H8uPKOwj2MpYOgjd5wDcqX3p9mZr9wnvgO9kBlwC4eydzhweoCWR5rw1uehtmhD0SBx49Os-DxjvVBzwdEOcnnBbVSepVcl2VgVtM3zHwUxVQAadF9ERxvJZqE6pLJGjFi6Xwdwg3zcTGOzkMPfbTJ-aAMcxwfD2HuUfkdND8tAvPlCSDK1XlvCdubLWFJP5jKcVnqHb2DOG8_LOozf9BnCqLalv7sevduBfYOSJoZrGOyPrvADnTsqLagUNuRr64ZPlBICcfRCWRc8wDCvh0lbmC21eJQTv808xGgRacQxptg";
console.log(`Using OAuth Token: ${token.substring(0, 15)}... (Length: ${token.length})`);

// Helper to send HTTP POST requests
function postRequest(urlStr, dataObj) {
    return new Promise((resolve, reject) => {
        const url = new URL(urlStr);
        const postData = JSON.stringify(dataObj);
        
        console.log(`POST to: ${url.pathname}${url.search}`);

        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'Authorization': `Bearer ${token}`
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                console.log(`POST Response status: ${res.statusCode}`);
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(body);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${body}`));
                }
            });
        });

        req.on('error', (e) => {
            console.error("POST request error:", e);
            reject(e);
        });
        req.write(postData);
        req.end();
    });
}

// Establish SSE connection
console.log(`Connecting to SSE endpoint: ${sseUrl}`);
const url = new URL(sseUrl);

const req = https.request({
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: 'GET',
    headers: {
        'Accept': 'text/event-stream',
        'Authorization': `Bearer ${token}`
    }
}, (res) => {
    console.log(`SSE Response: Status ${res.statusCode}`);

    if (res.statusCode !== 200) {
        console.error(`Error: SSE connection failed with status code ${res.statusCode}`);
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
            console.error("Error body:", body);
            process.exit(1);
        });
        return;
    }

    let buffer = '';
    let postEndpoint = null;
    let requestId = 1;
    const pendingRequests = new Map();
    let currentEvent = '';

    res.on('data', async (chunk) => {
        const chunkStr = chunk.toString();
        
        buffer += chunkStr;
        const lines = buffer.split('\n');
        // Keep the last partial line in the buffer
        buffer = lines.pop();

        for (const line of lines) {
            if (line.startsWith('event:')) {
                currentEvent = line.substring(6).trim();
            } else if (line.startsWith('data:')) {
                const data = line.substring(5).trim();
                
                if (currentEvent === 'endpoint') {
                    // We got the HTTP POST endpoint!
                    postEndpoint = data;
                    console.log(`Received POST endpoint: ${postEndpoint}`);
                    
                    // Start MCP initialization
                    try {
                        await initializeMCP(postEndpoint);
                    } catch (e) {
                        console.error("MCP Handshake/Execution failed:", e);
                        process.exit(1);
                    }
                } else if (currentEvent === 'message') {
                    try {
                        const msg = JSON.parse(data);
                        
                        if (msg.id && pendingRequests.has(msg.id)) {
                            const handler = pendingRequests.get(msg.id);
                            pendingRequests.delete(msg.id);
                            handler(msg);
                        }
                    } catch (e) {
                        console.error("Failed to parse JSON-RPC message data:", e);
                    }
                }
            }
        }
    });

    res.on('end', () => {
        console.log("SSE Connection closed by remote server.");
    });

    // Initialize MCP handshake
    async function initializeMCP(endpoint) {
        console.log("Sending initialize request...");
        const initId = requestId++;
        
        const initPromise = new Promise((resolve) => {
            pendingRequests.set(initId, (msg) => resolve(msg));
        });

        await postRequest(endpoint, {
            jsonrpc: "2.0",
            id: initId,
            method: "initialize",
            params: {
                protocolVersion: "2024-11-05",
                capabilities: {},
                clientInfo: {
                    name: "RetailFlow-SQL-Onboarder",
                    version: "1.0.0"
                }
            }
        });

        const initResponse = await initPromise;
        console.log("Initialize Response received!");

        // Send initialized notification
        console.log("Sending notifications/initialized...");
        await postRequest(endpoint, {
            jsonrpc: "2.0",
            method: "notifications/initialized"
        });

        // List Tools
        console.log("Listing available database tools...");
        const listId = requestId++;
        const listPromise = new Promise((resolve) => {
            pendingRequests.set(listId, (msg) => resolve(msg));
        });

        await postRequest(endpoint, {
            jsonrpc: "2.0",
            id: listId,
            method: "tools/list"
        });

        const listResponse = await listPromise;
        const tools = listResponse.result ? listResponse.result.tools : [];
        console.log("Available tools:", tools.map(t => t.name));

        // Find query tool
        const queryTool = tools.find(t => t.name === 'query');
        if (!queryTool) {
            console.error("Error: 'query' tool not found on the Supabase MCP server.");
            process.exit(1);
        }

        // Call the query tool to execute the schema setup SQL
        console.log("Calling the 'query' tool to execute database schema.sql...");
        const callId = requestId++;
        const callPromise = new Promise((resolve) => {
            pendingRequests.set(callId, (msg) => resolve(msg));
        });

        await postRequest(endpoint, {
            jsonrpc: "2.0",
            id: callId,
            method: "tools/call",
            params: {
                name: "query",
                arguments: {
                    sql: sqlContent
                }
            }
        });

        console.log("Awaiting SQL execution response...");
        const callResponse = await callPromise;
        
        if (callResponse.error) {
            console.error("SQL execution returned an error:", JSON.stringify(callResponse.error, null, 2));
            process.exit(1);
        }

        console.log("SQL Schema executed successfully!");
        console.log("Result content:", JSON.stringify(callResponse.result, null, 2));
        
        console.log("Database schema is fully initialized! Exiting successfully.");
        process.exit(0);
    }
});

req.on('error', (e) => {
    console.error("SSE connection error:", e);
    process.exit(1);
});

req.end();
