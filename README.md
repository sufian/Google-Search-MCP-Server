# Google Search MCP Server

## Works amazingly with Cline + VS Code!!

An MCP (Model Context Protocol) server that provides Google search capabilities and webpage content analysis tools. This server enables AI models to perform Google searches and analyze webpage content programmatically.

## Features

- Google Custom Search integration
- Webpage content analysis
- Batch webpage analysis
- MCP-compliant interface

## Prerequisites

- Node.js (v16 or higher)
- Python (v3.8 or higher)
- Google Cloud Platform account
- Custom Search Engine ID
- Google API Key

## Installation

1. Clone the repository
2. Install Node.js dependencies:
```bash
npm install
```

3. Install Python dependencies:
```bash
pip install flask google-api-python-client flask-cors
```

## Configuration

1. Create a `api-keys.json` file in the root directory with your Google API credentials:
```json
{
    "api_key": "your-google-api-key",
    "search_engine_id": "your-custom-search-engine-id"
}
```

2. Add the server configuration to your MCP settings file (typically located at `%APPDATA%/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`):
```json
{
  "mcpServers": {
    "google-search": {
      "command": "npm",
      "args": ["run", "start:all"],
      "cwd": "/path/to/google-search-server"
    }
  }
}
```

## Building

```bash
npm run build
```

## Running

Start both the TypeScript and Python servers:
```bash
npm run start:all
```

Or run them separately:
- TypeScript server: `npm start`
- Python servers: `npm run start:python`

## Available Tools

### 1. google_search
Search Google and return relevant results from the web. This tool finds web pages, articles, and information on specific topics using Google's search engine.

```typescript
{
  "name": "google_search",
  "arguments": {
    "query": "your search query",
    "num_results": 5 // optional, default: 5
  }
}
```

### 2. extract_webpage_content
Extract and analyze content from a webpage, converting it to readable text. This tool fetches the main content while removing ads, navigation elements, and other clutter.

```typescript
{
  "name": "extract_webpage_content",
  "arguments": {
    "url": "https://example.com"
  }
}
```

### 3. extract_multiple_webpages
Extract and analyze content from multiple webpages in a single request. Ideal for comparing information across different sources or gathering comprehensive information on a topic.

```typescript
{
  "name": "extract_multiple_webpages",
  "arguments": {
    "urls": [
      "https://example1.com",
      "https://example2.com"
    ]
  }
}
```

## Getting Google API Credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Custom Search API
4. Create API credentials (API Key)
5. Go to the [Custom Search Engine](https://programmablesearchengine.google.com/about/) page
6. Create a new search engine and get your Search Engine ID
7. Add these credentials to your `api-keys.json` file

## Error Handling

The server provides detailed error messages for:
- Missing or invalid API credentials
- Failed search requests
- Invalid webpage URLs
- Network connectivity issues

## Architecture

The server consists of two main components:
1. TypeScript MCP Server: Handles MCP protocol communication and provides the tool interface
2. Python Flask Server: Manages Google API interactions and webpage content analysis

## License

MIT
