import express from 'express';
import { GoogleSearchService } from './services/google-search.service.js';
import { ContentExtractor } from './services/content-extractor.service.js';
import { OutputFormat } from './types.js';

class GoogleSearchServer {
  private server: Server;
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
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      next();
    });
  }

  private setupRoutes() {
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    this.app.get('/tools', (req, res) => {
      res.json({
        tools: [
          {
            name: 'google_search',
            description: 'Search Google and return relevant results from the web.',
            parameters: {
              query: { type: 'string', required: true, description: 'Search query' },
              num_results: { type: 'number', description: 'Number of results (default: 5, max: 10)' },
              site: { type: 'string', description: 'Limit to specific domain' },
              language: { type: 'string', description: 'Language filter (ISO 639-1 codes)' },
              dateRestrict: { type: 'string', description: 'Date restriction (d[n], w[n], m[n], y[n])' },
              exactTerms: { type: 'string', description: 'Exact phrase search' },
              resultType: { type: 'string', description: 'Result type (image, news, video)' },
              page: { type: 'number', description: 'Page number for pagination' },
              resultsPerPage: { type: 'number', description: 'Results per page' },
              sort: { type: 'string', description: 'Sort method (relevance, date)' }
            }
          },
          {
            name: 'extract_webpage_content',
            description: 'Extract and analyze content from a webpage.',
            parameters: {
              url: { type: 'string', required: true, description: 'URL to extract content from' },
              format: { type: 'string', description: 'Output format (markdown, html, text)' }
            }
          },
          {
            name: 'extract_multiple_webpages',
            description: 'Extract content from multiple webpages (max 5).',
            parameters: {
              urls: { type: 'array', required: true, description: 'Array of URLs to extract' },
              format: { type: 'string', description: 'Output format (markdown, html, text)' }
            }
          }
        ]
      });
    });

    this.app.post('/search/stream', this.handleStreamingSearch.bind(this));
    this.app.post('/extract/stream', this.handleStreamingExtract.bind(this));
    this.app.post('/extract-multiple/stream', this.handleStreamingBatchExtract.bind(this));
  }

  private async handleStreamingSearch(req: express.Request, res: express.Response) {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    try {
      const { query, num_results, ...filters } = req.body;
      
      if (!query) {
        res.write(JSON.stringify({ error: 'Query is required' }) + '\n');
        res.end();
        return;
      }

      res.write(JSON.stringify({ status: 'starting', message: 'Initiating search...' }) + '\n');

      const result = await this.handleSearch({ query, num_results, filters });
      
      res.write(JSON.stringify({ status: 'complete', data: result }) + '\n');
      res.end();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.write(JSON.stringify({ status: 'error', error: message }) + '\n');
      res.end();
    }
  }

  private async handleStreamingExtract(req: express.Request, res: express.Response) {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    try {
      const { url, format } = req.body;
      
      if (!url) {
        res.write(JSON.stringify({ error: 'URL is required' }) + '\n');
        res.end();
        return;
      }

      res.write(JSON.stringify({ status: 'starting', message: 'Extracting content...' }) + '\n');

      const result = await this.handleAnalyzeWebpage({ url, format });
      
      res.write(JSON.stringify({ status: 'complete', data: result }) + '\n');
      res.end();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.write(JSON.stringify({ status: 'error', error: message }) + '\n');
      res.end();
    }
  }

  private async handleStreamingBatchExtract(req: express.Request, res: express.Response) {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    try {
      const { urls, format } = req.body;
      
      if (!urls || !Array.isArray(urls)) {
        res.write(JSON.stringify({ error: 'URLs array is required' }) + '\n');
        res.end();
        return;
      }

      res.write(JSON.stringify({ status: 'starting', message: `Extracting content from ${urls.length} URLs...` }) + '\n');

      const result = await this.handleBatchAnalyzeWebpages({ urls, format });
      
      res.write(JSON.stringify({ status: 'complete', data: result }) + '\n');
      res.end();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.write(JSON.stringify({ status: 'error', error: message }) + '\n');
      res.end();
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

  async start(port: number = 5656) {
    try {
      this.app.listen(port, () => {
        console.log(`Google Search HTTP streaming server running on port ${port}`);
        console.log(`Health check: http://localhost:${port}/health`);
        console.log(`Available tools: http://localhost:${port}/tools`);
        console.log(`Streaming endpoints:`);
        console.log(`  POST http://localhost:${port}/search/stream`);
        console.log(`  POST http://localhost:${port}/extract/stream`);
        console.log(`  POST http://localhost:${port}/extract-multiple/stream`);
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
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Failed to start HTTP server:', error.message);
      } else {
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
