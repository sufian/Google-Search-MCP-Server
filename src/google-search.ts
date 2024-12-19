import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { SearchResult, SearchResponse } from './types.js';
import { ContentFetcher } from './content-fetcher.js';
import axios from 'axios';

class GoogleSearchServer {
  private server: Server;
  private contentFetcher: ContentFetcher;

  constructor() {
    this.server = new Server({
      name: 'google-search',
      version: '1.0.0'
    }, {
      capabilities: {
        tools: {
          search: {
            description: 'Search Google and return relevant results',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query' },
                num_results: { type: 'number', description: 'Number of results to return (default: 5)' }
              },
              required: ['query']
            }
          },
          analyze_webpage: {
            description: 'Analyze and extract content from a webpage',
            inputSchema: {
              type: 'object',
              properties: {
                url: { type: 'string', description: 'URL of the webpage to analyze' }
              },
              required: ['url']
            }
          },
          batch_analyze_webpages: {
            description: 'Analyze and extract content from multiple webpages',
            inputSchema: {
              type: 'object',
              properties: {
                urls: { 
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Array of URLs to analyze'
                }
              },
              required: ['urls']
            }
          }
        }
      }
    });

    this.contentFetcher = new ContentFetcher();

    // Register tool list handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'search',
          description: 'Search Google and return relevant results',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              num_results: { type: 'number', description: 'Number of results to return (default: 5)' }
            },
            required: ['query']
          }
        },
        {
          name: 'analyze_webpage',
          description: 'Analyze and extract content from a webpage',
          inputSchema: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'URL of the webpage to analyze' }
            },
            required: ['url']
          }
        },
        {
          name: 'batch_analyze_webpages',
          description: 'Analyze and extract content from multiple webpages',
          inputSchema: {
            type: 'object',
            properties: {
              urls: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of URLs to analyze'
              }
            },
            required: ['urls']
          }
        }
      ]
    }));

    // Register tool call handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'search':
          if (typeof request.params.arguments === 'object' && request.params.arguments !== null && 'query' in request.params.arguments) {
            return this.handleSearch({
              query: String(request.params.arguments.query),
              num_results: typeof request.params.arguments.num_results === 'number' ? request.params.arguments.num_results : undefined
            });
          }
          throw new Error('Invalid arguments for search tool');

        case 'analyze_webpage':
          if (typeof request.params.arguments === 'object' && request.params.arguments !== null && 'url' in request.params.arguments) {
            return this.handleAnalyzeWebpage({
              url: String(request.params.arguments.url)
            });
          }
          throw new Error('Invalid arguments for analyze_webpage tool');

        case 'batch_analyze_webpages':
          if (typeof request.params.arguments === 'object' && request.params.arguments !== null && 'urls' in request.params.arguments && Array.isArray(request.params.arguments.urls)) {
            return this.handleBatchAnalyzeWebpages({
              urls: request.params.arguments.urls.map(String)
            });
          }
          throw new Error('Invalid arguments for batch_analyze_webpages tool');

        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    });
  }

  private async handleSearch(args: { query: string; num_results?: number }) {
    try {
      const response = await axios.post<SearchResponse>('http://localhost:5000/search', {
        query: args.query,
        num_results: args.num_results || 5,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response.data.results, null, 2),
          },
        ],
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Search failed: ${error.response?.data?.error || error.message}`);
      }
      throw error;
    }
  }

  private async handleAnalyzeWebpage(args: { url: string }) {
    try {
      const content = await this.contentFetcher.fetchContent(args.url);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(content, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: error instanceof Error ? error.message : 'Unknown error occurred',
          },
        ],
        isError: true,
      };
    }
  }

  private async handleBatchAnalyzeWebpages(args: { urls: string[] }) {
    try {
      const results = await this.contentFetcher.batchFetchContent(args.urls);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: error instanceof Error ? error.message : 'Unknown error occurred',
          },
        ],
        isError: true,
      };
    }
  }

  async start() {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.error('Google Search MCP server running');
      
      // Keep the process running
      process.on('SIGINT', () => {
        this.server.close().catch(console.error);
        process.exit(0);
      });
    } catch (error) {
      console.error('Failed to start MCP server:', error);
      process.exit(1);
    }
  }
}

// Start the server
const server = new GoogleSearchServer();
server.start().catch(console.error);
