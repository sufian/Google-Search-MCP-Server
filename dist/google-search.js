import express from 'express';
import { config } from 'dotenv';
import { GoogleSearchService } from './services/google-search.service.js';
import { ContentExtractor } from './services/content-extractor.service.js';
config();
class GoogleSearchServer {
    constructor() {
        this.searchService = new GoogleSearchService();
        this.contentExtractor = new ContentExtractor();
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();
    }
    setupMiddleware() {
        this.app.use(express.json());
        // Security: Validate Origin header to prevent DNS rebinding attacks
        this.app.use((req, res, next) => {
            const origin = req.get('Origin');
            if (origin && !this.isAllowedOrigin(origin)) {
                return res.status(403).json({ error: 'Forbidden origin' });
            }
            next();
        });
        // CORS headers
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id');
            res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            next();
        });
    }
    isAllowedOrigin(origin) {
        // Allow localhost and common development origins
        const allowed = [
            'http://localhost',
            'https://localhost',
            'http://127.0.0.1',
            'https://127.0.0.1'
        ];
        return allowed.some(allowedOrigin => origin.startsWith(allowedOrigin));
    }
    setupRoutes() {
        // Main MCP endpoint - supports both GET and POST
        this.app.all('/mcp', this.handleMCPRequest.bind(this));
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({ status: 'healthy', timestamp: new Date().toISOString() });
        });
        // OPTIONS for CORS preflight
        this.app.options('*', (req, res) => {
            res.status(200).end();
        });
    }
    async handleMCPRequest(req, res) {
        // MCP Protocol Version is optional for broader compatibility
        if (req.method === 'GET') {
            return this.handleGetRequest(req, res);
        }
        else if (req.method === 'POST') {
            return this.handlePostRequest(req, res);
        }
        else {
            return res.status(405).json({
                jsonrpc: '2.0',
                error: {
                    code: -32601,
                    message: 'Method not allowed'
                },
                id: null
            });
        }
    }
    handleGetRequest(req, res) {
        const acceptHeader = req.get('Accept');
        if (!acceptHeader?.includes('text/event-stream')) {
            return res.status(400).json({
                jsonrpc: '2.0',
                error: {
                    code: -32600,
                    message: 'GET requests must include Accept: text/event-stream'
                },
                id: null
            });
        }
        // Set up SSE headers
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
        });
        // Keep connection alive
        const keepAlive = setInterval(() => {
            res.write('data: \n\n');
        }, 30000);
        req.on('close', () => {
            clearInterval(keepAlive);
        });
    }
    async handlePostRequest(req, res) {
        const acceptHeader = req.get('Accept');
        const wantsStream = acceptHeader?.includes('text/event-stream');
        const wantsJSON = acceptHeader?.includes('application/json');
        if (!wantsStream && !wantsJSON) {
            return res.status(400).json({
                jsonrpc: '2.0',
                error: {
                    code: -32600,
                    message: 'Accept header must include application/json or text/event-stream'
                },
                id: null
            });
        }
        try {
            const jsonRpcRequest = req.body;
            // Validate JSON-RPC format
            if (!jsonRpcRequest.jsonrpc || jsonRpcRequest.jsonrpc !== '2.0') {
                return res.status(400).json({
                    jsonrpc: '2.0',
                    error: {
                        code: -32600,
                        message: 'Invalid JSON-RPC format'
                    },
                    id: jsonRpcRequest.id || null
                });
            }
            // Handle different JSON-RPC methods
            if (jsonRpcRequest.method === 'tools/list') {
                return this.handleToolsList(jsonRpcRequest, res, !!wantsStream);
            }
            else if (jsonRpcRequest.method === 'tools/call') {
                return this.handleToolsCall(jsonRpcRequest, res, !!wantsStream);
            }
            else if (jsonRpcRequest.method === 'initialize') {
                return this.handleInitialize(jsonRpcRequest, res, !!wantsStream);
            }
            else {
                return res.status(400).json({
                    jsonrpc: '2.0',
                    error: {
                        code: -32601,
                        message: `Method not found: ${jsonRpcRequest.method}`
                    },
                    id: jsonRpcRequest.id || null
                });
            }
        }
        catch (error) {
            return res.status(400).json({
                jsonrpc: '2.0',
                error: {
                    code: -32700,
                    message: 'Parse error'
                },
                id: null
            });
        }
    }
    async handleInitialize(jsonRpcRequest, res, wantsStream) {
        const response = {
            jsonrpc: '2.0',
            id: jsonRpcRequest.id,
            result: {
                protocolVersion: '2024-11-05',
                capabilities: {
                    tools: {},
                },
                serverInfo: {
                    name: 'Google Search MCP Server',
                    version: '1.0.0'
                }
            }
        };
        if (wantsStream) {
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            });
            res.write(`data: ${JSON.stringify(response)}\n\n`);
            res.end();
        }
        else {
            res.json(response);
        }
    }
    async handleToolsList(jsonRpcRequest, res, wantsStream) {
        const response = {
            jsonrpc: '2.0',
            id: jsonRpcRequest.id,
            result: {
                tools: [
                    {
                        name: 'google_search',
                        description: 'Search Google and return relevant results from the web.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                query: { type: 'string', description: 'Search query' },
                                num_results: { type: 'number', description: 'Number of results (default: 5, max: 10)' },
                                site: { type: 'string', description: 'Limit to specific domain' },
                                language: { type: 'string', description: 'Language filter (ISO 639-1 codes)' },
                                dateRestrict: { type: 'string', description: 'Date restriction (d[n], w[n], m[n], y[n])' },
                                exactTerms: { type: 'string', description: 'Exact phrase search' },
                                resultType: { type: 'string', description: 'Result type (image, news, video)' },
                                page: { type: 'number', description: 'Page number for pagination' },
                                resultsPerPage: { type: 'number', description: 'Results per page' },
                                sort: { type: 'string', description: 'Sort method (relevance, date)' }
                            },
                            required: ['query']
                        }
                    },
                    {
                        name: 'extract_webpage_content',
                        description: 'Extract and analyze content from a webpage.',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                url: { type: 'string', description: 'URL to extract content from' },
                                format: { type: 'string', enum: ['markdown', 'html', 'text'], description: 'Output format' }
                            },
                            required: ['url']
                        }
                    },
                    {
                        name: 'extract_multiple_webpages',
                        description: 'Extract content from multiple webpages (max 5).',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                urls: { type: 'array', items: { type: 'string' }, description: 'Array of URLs to extract' },
                                format: { type: 'string', enum: ['markdown', 'html', 'text'], description: 'Output format' }
                            },
                            required: ['urls']
                        }
                    }
                ]
            }
        };
        if (wantsStream) {
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            });
            res.write(`data: ${JSON.stringify(response)}\n\n`);
            res.end();
        }
        else {
            res.json(response);
        }
    }
    async handleToolsCall(jsonRpcRequest, res, wantsStream) {
        const { name, arguments: args } = jsonRpcRequest.params;
        try {
            let result;
            switch (name) {
                case 'google_search':
                    result = await this.handleSearch(args);
                    break;
                case 'extract_webpage_content':
                    result = await this.handleAnalyzeWebpage(args);
                    break;
                case 'extract_multiple_webpages':
                    result = await this.handleBatchAnalyzeWebpages(args);
                    break;
                default:
                    const errorResponse = {
                        jsonrpc: '2.0',
                        id: jsonRpcRequest.id,
                        error: {
                            code: -32601,
                            message: `Unknown tool: ${name}`
                        }
                    };
                    return res.status(400).json(errorResponse);
            }
            const response = {
                jsonrpc: '2.0',
                id: jsonRpcRequest.id,
                result
            };
            if (wantsStream) {
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                });
                // Send progress updates if streaming
                res.write(`data: ${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/progress', params: { token: jsonRpcRequest.id, progress: 0, total: 1 } })}\n\n`);
                res.write(`data: ${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/progress', params: { token: jsonRpcRequest.id, progress: 1, total: 1 } })}\n\n`);
                res.write(`data: ${JSON.stringify(response)}\n\n`);
                res.end();
            }
            else {
                res.json(response);
            }
        }
        catch (error) {
            const errorResponse = {
                jsonrpc: '2.0',
                id: jsonRpcRequest.id,
                error: {
                    code: -32603,
                    message: error instanceof Error ? error.message : 'Internal error'
                }
            };
            if (wantsStream) {
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                });
                res.write(`data: ${JSON.stringify(errorResponse)}\n\n`);
                res.end();
            }
            else {
                res.status(500).json(errorResponse);
            }
        }
    }
    async handleSearch(args) {
        try {
            const { results, pagination, categories } = await this.searchService.search(args.query, args.num_results, args.filters);
            if (results.length === 0) {
                return {
                    content: [{
                            type: 'text',
                            text: 'No results found. Try:\n- Using different keywords\n- Removing quotes from non-exact phrases\n- Using more general terms'
                        }],
                    isError: true
                };
            }
            // Format results in a more concise, readable way
            const formattedResults = results.map(result => ({
                title: result.title,
                link: result.link,
                snippet: result.snippet,
                category: result.category
            }));
            // Format results in a more AI-friendly way
            let responseText = `Search results for "${args.query}":\n\n`;
            // Add category summary if available
            if (categories && categories.length > 0) {
                responseText += "Categories: " + categories.map(c => `${c.name} (${c.count})`).join(', ') + "\n\n";
            }
            // Add pagination info
            if (pagination) {
                responseText += `Showing page ${pagination.currentPage}${pagination.totalResults ? ` of approximately ${pagination.totalResults} results` : ''}\n\n`;
            }
            // Add each result in a readable format
            formattedResults.forEach((result, index) => {
                responseText += `${index + 1}. ${result.title}\n`;
                responseText += `   URL: ${result.link}\n`;
                responseText += `   ${result.snippet}\n\n`;
            });
            // Add navigation hints if pagination exists
            if (pagination && (pagination.hasNextPage || pagination.hasPreviousPage)) {
                responseText += "Navigation: ";
                if (pagination.hasPreviousPage) {
                    responseText += "Use 'page: " + (pagination.currentPage - 1) + "' for previous results. ";
                }
                if (pagination.hasNextPage) {
                    responseText += "Use 'page: " + (pagination.currentPage + 1) + "' for more results.";
                }
                responseText += "\n";
            }
            return {
                content: [
                    {
                        type: 'text',
                        text: responseText,
                    },
                ],
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error during search';
            return {
                content: [{ type: 'text', text: message }],
                isError: true
            };
        }
    }
    async handleAnalyzeWebpage(args) {
        try {
            const content = await this.contentExtractor.extractContent(args.url, args.format);
            // Format the response in a more readable, concise way
            let responseText = `Content from: ${content.url}\n\n`;
            responseText += `Title: ${content.title}\n`;
            if (content.description) {
                responseText += `Description: ${content.description}\n`;
            }
            responseText += `\nStats: ${content.stats.word_count} words, ${content.stats.approximate_chars} characters\n\n`;
            // Add the summary if available
            if (content.summary) {
                responseText += `Summary: ${content.summary}\n\n`;
            }
            // Add a preview of the content
            responseText += `Content Preview:\n${content.content_preview.first_500_chars}\n\n`;
            // Add a note about requesting specific information
            responseText += `Note: This is a preview of the content. For specific information, please ask about particular aspects of this webpage.`;
            return {
                content: [
                    {
                        type: 'text',
                        text: responseText,
                    },
                ],
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            const helpText = 'Common issues:\n- Check if the URL is accessible in a browser\n- Ensure the webpage is public\n- Try again if it\'s a temporary network issue';
            return {
                content: [
                    {
                        type: 'text',
                        text: `${errorMessage}\n\n${helpText}`,
                    },
                ],
                isError: true,
            };
        }
    }
    async handleBatchAnalyzeWebpages(args) {
        if (args.urls.length > 5) {
            return {
                content: [{
                        type: 'text',
                        text: 'Maximum 5 URLs allowed per request to maintain performance. Please reduce the number of URLs.'
                    }],
                isError: true
            };
        }
        try {
            const results = await this.contentExtractor.batchExtractContent(args.urls, args.format);
            // Format the response in a more readable, concise way
            let responseText = `Content from ${args.urls.length} webpages:\n\n`;
            for (const [url, result] of Object.entries(results)) {
                responseText += `URL: ${url}\n`;
                if ('error' in result) {
                    responseText += `Error: ${result.error}\n\n`;
                    continue;
                }
                responseText += `Title: ${result.title}\n`;
                if (result.description) {
                    responseText += `Description: ${result.description}\n`;
                }
                responseText += `Stats: ${result.stats.word_count} words\n`;
                // Add summary if available
                if (result.summary) {
                    responseText += `Summary: ${result.summary}\n`;
                }
                responseText += `Preview: ${result.content_preview.first_500_chars.substring(0, 150)}...\n\n`;
            }
            responseText += `Note: These are previews of the content. To analyze the full content of a specific URL, use the extract_webpage_content tool with that URL.`;
            return {
                content: [
                    {
                        type: 'text',
                        text: responseText,
                    },
                ],
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            const helpText = 'Common issues:\n- Check if all URLs are accessible in a browser\n- Ensure all webpages are public\n- Try again if it\'s a temporary network issue\n- Consider reducing the number of URLs';
            return {
                content: [
                    {
                        type: 'text',
                        text: `${errorMessage}\n\n${helpText}`,
                    },
                ],
                isError: true,
            };
        }
    }
    async start(port = 3000) {
        try {
            this.app.listen(port, () => {
                console.log(`🚀 Google Search MCP Server running on port ${port}`);
                console.log(`\n📡 MCP Protocol Endpoint:`);
                console.log(`  Main endpoint: http://localhost:${port}/mcp`);
                console.log(`  GET  /mcp - Open SSE stream`);
                console.log(`  POST /mcp - Send JSON-RPC requests`);
                console.log(`\n🔧 Utilities:`);
                console.log(`  Health check: http://localhost:${port}/health`);
                console.log(`\n📋 Required Headers:`);
                console.log(`  MCP-Protocol-Version: 2024-11-05`);
                console.log(`  Accept: application/json or text/event-stream`);
                console.log(`  Content-Type: application/json`);
                console.log(`\n🛠️  Available Methods:`);
                console.log(`  initialize, tools/list, tools/call`);
                console.log(`\n🌐 For n8n/HTTP clients: http://localhost:${port}/mcp`);
            });
            // Graceful shutdown
            process.on('SIGINT', () => {
                console.log('\nReceived SIGINT, shutting down gracefully...');
                process.exit(0);
            });
            process.on('SIGTERM', () => {
                console.log('\nReceived SIGTERM, shutting down gracefully...');
                process.exit(0);
            });
        }
        catch (error) {
            if (error instanceof Error) {
                console.error('Failed to start HTTP server:', error.message);
            }
            else {
                console.error('Failed to start HTTP server: Unknown error');
            }
            process.exit(1);
        }
    }
}
// Start the server
const server = new GoogleSearchServer();
const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
server.start(port).catch(console.error);
