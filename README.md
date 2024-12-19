# Google Search MCP Server

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

### 1. search
Perform Google searches and retrieve results.

```typescript
{
  "name": "search",
  "arguments": {
    "query": "your search query",
    "num_results": 5 // optional, default: 5
  }
}
```

### 2. analyze_webpage
Extract and analyze content from a single webpage.

```typescript
{
  "name": "analyze_webpage",
  "arguments": {
    "url": "https://example.com"
  }
}
```

### 3. batch_analyze_webpages
Analyze multiple webpages in a single request.

```typescript
{
  "name": "batch_analyze_webpages",
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
