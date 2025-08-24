import express from 'express';
import { GoogleSearchService } from './services/google-search.service.js';
import { ContentExtractor } from './services/content-extractor.service.js';
import { OutputFormat } from './types.js';

class GoogleSearchServer {
  private app: express.Application;
  private searchService: GoogleSearchService;
  private contentExtractor: ContentExtractor;

  constructor() {
    this.searchService = new GoogleSearchService();
    this.contentExtractor = new ContentExtractor();
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
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

  private isAllowedOrigin(origin: string): boolean {
    // Allow localhost and common development origins
    const allowed = [
      'http://localhost',
      'https://localhost',
      'http://127.0.0.1',
      'https://127.0.0.1'
    ];
    return allowed.some(allowedOrigin => origin.startsWith(allowedOrigin));
  }

  private setupRoutes() {
    // Main MCP endpoint - supports both GET and POST
    this.app.all('/mcp', this.handleMCPRequest.bind(this));
    
    // Simple HTTP endpoints for n8n compatibility
    this.app.post('/search', async (req, res) => {
      try {
        const result = await this.handleSearch(req.body);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    this.app.post('/extract', async (req, res) => {
      try {
        const result = await this.handleAnalyzeWebpage(req.body);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    this.app.post('/extract-multiple', async (req, res) => {
      try {
        const result = await this.handleBatchAnalyzeWebpages(req.body);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    // Server info endpoint
    this.app.get('/', (req, res) => {
      res.json({
        name: 'Google Search MCP Server',
        version: '1.0.0',
        endpoints: {
          mcp: '/mcp (JSON-RPC)',
          search: '/search (simple HTTP)',
          extract: '/extract (simple HTTP)',
          extractMultiple: '/extract-multiple (simple HTTP)',
          health: '/health'
        }
      });
    });

    // OPTIONS for CORS preflight
    this.app.options('*', (req, res) => {
      res.status(200).end();
    });
  }

  private async handleMCPRequest(req: express.Request, res: express.Response) {
    // MCP Protocol Version is optional for broader compatibility

    if (req.method === 'GET') {
      return this.handleGetRequest(req, res);
    } else if (req.method === 'POST') {
      return this.handlePostRequest(req, res);
    } else {
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

  private handleGetRequest(req: express.Request, res: express.Response) {
    const acceptHeader = req.get('Accept');
    
    // For n8n compatibility, allow GET requests to return server info
    if (!acceptHeader?.includes('text/event-stream')) {
      return res.json({
        server: {
          name: 'Google Search MCP Server',
          version: '1.0.0',
          description: 'MCP server for Google Search and webpage content extraction',
          protocol: 'MCP over HTTP'
        },
        endpoints: {
          main: '/mcp',
          health: '/health'
        },
        methods: ['initialize', 'tools/list', 'tools/call'],
        usage: 'Send POST requests to /mcp with JSON-RPC format'
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

  private async handlePostRequest(req: express.Request, res: express.Response) {
    const acceptHeader = req.get('Accept');
    const wantsStream = acceptHeader?.includes('text/event-stream');
    const wantsJSON = acceptHeader?.includes('application/json') || !acceptHeader;

    // Default to JSON for n8n compatibility
    const preferJSON = wantsJSON || !wantsStream;

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
        return this.handleToolsList(jsonRpcRequest, res, !preferJSON);
      } else if (jsonRpcRequest.method === 'tools/call') {
        return this.handleToolsCall(jsonRpcRequest, res, !preferJSON);
      } else if (jsonRpcRequest.method === 'initialize') {
        return this.handleInitialize(jsonRpcRequest, res, !preferJSON);
      } else {
        return res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32601,
            message: `Method not found: ${jsonRpcRequest.method}`
          },
          id: jsonRpcRequest.id || null
        });
      }
    } catch (error) {
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

  private async handleInitialize(jsonRpcRequest: any, res: express.Response, wantsStream: boolean) {
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
    } else {
      res.json(response);
    }
  }

  private async handleToolsList(jsonRpcRequest: any, res: express.Response, wantsStream: boolean) {
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
    } else {
      res.json(response);
    }
  }

  private async handleToolsCall(jsonRpcRequest: any, res: express.Response, wantsStream: boolean) {
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
      } else {
        res.json(response);
      }
    } catch (error) {
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
      } else {
        res.status(500).json(errorResponse);
      }
    }
  }

  private async handleSearch(args: { 
    query: string; 
    num_results?: number; 
    filters?: { 
      site?: string; 
      language?: string;
      dateRestrict?: string;
      exactTerms?: string;
      resultType?: string;
      page?: number;
      resultsPerPage?: number;
      sort?: string;
    } 
  }) {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error during search';
      return {
        content: [{ type: 'text', text: message }],
        isError: true
      };
    }
  }

  private async handleAnalyzeWebpage(args: { url: string; format?: OutputFormat; summarize?: boolean }) {
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
    } catch (error) {
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

  private async handleBatchAnalyzeWebpages(args: { urls: string[]; format?: OutputFormat }) {
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
    } catch (error) {
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

  async start(port: number = 3000) {
    return new Promise<void>((resolve, reject) => {
      try {
        const server = this.app.listen(port, '0.0.0.0', () => {
          console.log(`🚀 Google Search MCP Server running on port ${port}`);
          console.log(`\n📡 MCP Protocol Endpoint:`);
          console.log(`  Main endpoint: http://0.0.0.0:${port}/mcp`);
          console.log(`  GET  /mcp - Open SSE stream`);
          console.log(`  POST /mcp - Send JSON-RPC requests`);
          console.log(`\n🔧 Utilities:`);
          console.log(`  Health check: http://0.0.0.0:${port}/health`);
          console.log(`\n📋 Required Headers:`);
          console.log(`  MCP-Protocol-Version: 2024-11-05 (optional)`);
          console.log(`  Accept: application/json or text/event-stream`);
          console.log(`  Content-Type: application/json`);
          console.log(`\n🛠️  Available Methods:`);
          console.log(`  initialize, tools/list, tools/call`);
          console.log(`\n🌐 For Docker/external access: http://0.0.0.0:${port}/mcp`);
          console.log(`\n✅ Server ready and listening...`);
          resolve();
        });

        server.on('error', (error) => {
          console.error('Server error:', error);
          reject(error);
        });
        
        // Graceful shutdown
        process.on('SIGINT', () => {
          console.log('\nReceived SIGINT, shutting down gracefully...');
          server.close(() => {
            console.log('Server closed');
            process.exit(0);
          });
        });

        process.on('SIGTERM', () => {
          console.log('\nReceived SIGTERM, shutting down gracefully...');
          server.close(() => {
            console.log('Server closed');
            process.exit(0);
          });
        });

        // Server is now ready and listening

      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error('Failed to start HTTP server:', error.message);
        } else {
          console.error('Failed to start HTTP server: Unknown error');
        }
        reject(error);
      }
    });
  }
}

// Start the server
async function startServer() {
  console.log('🚀 Starting Google Search MCP Server...');
  
  try {
    console.log('📋 Environment check:');
    console.log(`  NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
    console.log(`  PORT: ${process.env.PORT || 'not set (using 3000)'}`);
    console.log(`  GOOGLE_API_KEY: ${process.env.GOOGLE_API_KEY ? 'set' : 'NOT SET'}`);
    console.log(`  GOOGLE_SEARCH_ENGINE_ID: ${process.env.GOOGLE_SEARCH_ENGINE_ID ? 'set' : 'NOT SET'}`);
    
    if (!process.env.GOOGLE_API_KEY || !process.env.GOOGLE_SEARCH_ENGINE_ID) {
      throw new Error('Missing required environment variables: GOOGLE_API_KEY and GOOGLE_SEARCH_ENGINE_ID');
    }
    
    console.log('🏗️  Creating server instance...');
    const server = new GoogleSearchServer();
    
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
    console.log(`🌐 Attempting to bind to 0.0.0.0:${port}...`);
    
    await server.start(port);
    console.log('🎯 MCP Server successfully initialized and running');
    console.log('♾️  Process will stay alive...');
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    if (error instanceof Error) {
      console.error('📋 Error details:', error.message);
      console.error('📋 Error stack:', error.stack);
    }
    throw error;
  }
}

// Handle startup errors
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception during startup:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled rejection during startup:', promise, 'reason:', reason);
  process.exit(1);
});

console.log('🏁 Google Search MCP Server v1.0.0');
console.log('📅 Build timestamp:', new Date().toISOString());
console.log('🐳 Container starting...');

startServer().catch((error) => {
  console.error('💥 Startup failed:', error);
  process.exit(1);
});
