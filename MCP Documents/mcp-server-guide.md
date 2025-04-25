# Guide for Building an MCP Server

## Introduction to MCP Servers

A Model Context Protocol (MCP) server is a component that exposes data, tools, and prompts to LLM applications in a standardized way. Think of it as an API specifically designed for LLM interactions.

MCP servers can:
- Expose data through **Resources** (providing context to LLMs)
- Provide functionality through **Tools** (executable functions)
- Define interaction patterns through **Prompts** (reusable templates for LLM interactions)

## Prerequisites

- Node.js (version 18 or later) and npm
- Basic knowledge of TypeScript/JavaScript or Python
- VS Code (recommended for development)

## Getting Started with TypeScript Implementation

### 1. Setting Up Your Project

Create a new directory for your MCP server:

```bash
mkdir my-mcp-server
cd my-mcp-server
npm init -y
```

Install the MCP SDK:

```bash
npm install @modelcontextprotocol/sdk
```

Add TypeScript and other dev dependencies:

```bash
npm install --save-dev typescript ts-node @types/node
```

Create a `tsconfig.json` file:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "NodeNext",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "./build"
  },
  "include": ["src/**/*"]
}
```

### 2. Creating Your Server

Create a `src` directory and an `index.ts` file inside it:

```bash
mkdir src
touch src/index.ts
```

### 3. Basic Server Implementation

Here's a basic MCP server implementation:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "@modelcontextprotocol/sdk/deps.js";

// Create a new MCP server
const server = new McpServer({
  name: "example-server",
  version: "1.0.0",
});

// Define a resource
server.resource(
  "greeting",
  {},
  async () => {
    return {
      content: {
        type: "text",
        text: "Hello from MCP server!",
      },
    };
  }
);

// Define a tool
server.tool(
  "echo",
  {
    message: z.string().describe("Message to echo"),
  },
  async ({ message }) => {
    return {
      content: {
        type: "text",
        text: `You said: ${message}`,
      },
    };
  }
);

// Define a prompt
server.prompt(
  "introduce",
  {
    name: z.string().describe("Person's name"),
  },
  ({ name }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Please introduce yourself to ${name}.`,
        },
      },
    ],
  })
);

// Start the server
const transport = new StdioServerTransport();
server.listen(transport);
```

### 4. Building and Running

Add scripts to your `package.json`:

```json
"scripts": {
  "build": "tsc",
  "start": "node build/index.js"
}
```

Build and run your server:

```bash
npm run build
npm run start
```

## Getting Started with Python Implementation

### 1. Setting Up Your Python Environment

```bash
# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install the MCP SDK
pip install mcp-sdk
```

### 2. Creating a Basic Python MCP Server

Create a file named `server.py`:

```python
import asyncio
from mcp import Server, StdioTransport, Tool, Resource, Prompt
from pydantic import BaseModel

class EchoParams(BaseModel):
    message: str

class GreetingParams(BaseModel):
    name: str

# Create a server
server = Server(name="python-example-server", version="1.0.0")

# Define a resource
@server.resource("greeting")
async def greeting_resource(params=None):
    return {
        "content": {
            "type": "text",
            "text": "Hello from Python MCP server!"
        }
    }

# Define a tool
@server.tool("echo")
async def echo_tool(params: EchoParams):
    return {
        "content": {
            "type": "text",
            "text": f"You said: {params.message}"
        }
    }

# Define a prompt
@server.prompt("introduce")
async def introduce_prompt(params: GreetingParams):
    return {
        "messages": [
            {
                "role": "user",
                "content": {
                    "type": "text",
                    "text": f"Please introduce yourself to {params.name}."
                }
            }
        ]
    }

# Run the server
if __name__ == "__main__":
    transport = StdioTransport()
    asyncio.run(server.listen(transport))
```

Run your Python server:

```bash
python server.py
```

## Advanced MCP Server Concepts

### 1. Adding Authentication

For HTTP transport, you might need to add authentication:

```typescript
// TypeScript example
import { HttpServerTransport } from "@modelcontextprotocol/sdk/server/http.js";

const transport = new HttpServerTransport({
  port: 3000,
  auth: async (req) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (token !== "your-secret-token") {
      throw new Error("Unauthorized");
    }
  },
});
```

### 2. Working with External APIs

MCP servers often connect to external services:

```typescript
// TypeScript example with an external API
import fetch from "node-fetch";

server.tool(
  "get-weather",
  {
    location: z.string().describe("Location to get weather for"),
  },
  async ({ location }) => {
    try {
      const response = await fetch(
        `https://api.weatherapi.com/v1/current.json?key=YOUR_API_KEY&q=${location}`
      );
      const data = await response.json();
      
      return {
        content: {
          type: "text",
          text: `Current weather in ${location}: ${data.current.temp_c}°C, ${data.current.condition.text}`,
        },
      };
    } catch (error) {
      return {
        content: {
          type: "text",
          text: `Error fetching weather data: ${error.message}`,
        },
      };
    }
  }
);
```

### 3. Dynamic Resources

Resources can dynamically generate content based on parameters:

```typescript
server.resource(
  "document",
  {
    id: z.string().describe("Document ID to retrieve"),
  },
  async ({ id }) => {
    // Imagine this fetches from a database
    const document = await getDocumentById(id);
    
    return {
      content: {
        type: "text",
        text: document.content,
      },
    };
  }
);
```

## Best Practices

1. **Keep it Simple**: Start with basic capabilities and expand gradually.
2. **Error Handling**: Always include proper error handling in your tools and resources.
3. **Validation**: Use Zod (TypeScript) or Pydantic (Python) for robust parameter validation.
4. **Documentation**: Provide clear descriptions for all tools, resources, and prompts.
5. **Security**: Be cautious about what your server exposes, especially with tools that execute code.
6. **Testing**: Test your MCP server with real clients like Claude Desktop or Cody.
7. **Platform Compatibility**: 
   - Test on both Unix and Windows systems
   - Use binary mode for stdio on Windows
   - Handle path separators correctly
   - Consider using cross-platform libraries
8. **Resource Management**:
   - Implement proper cleanup for resources
   - Handle connection timeouts gracefully
   - Monitor memory usage
   - Cache responses when appropriate
9. **Versioning**:
   - Follow semantic versioning
   - Maintain backwards compatibility
   - Document breaking changes
   - Provide migration guides

## Platform-Specific Considerations

### Windows Implementation
When developing MCP servers for Windows:

1. **stdio Handling**:
```typescript
if (process.platform === 'win32') {
    process.stdin.setEncoding('binary');
    process.stdout.setDefaultEncoding('binary');
}
```

2. **Path Management**:
```typescript
import { join } from 'path';

const configPath = join(process.cwd(), 'config.json');
```

3. **Error Handling**:
```typescript
process.on('uncaughtException', (error) => {
    console.error(`Uncaught Exception: ${error.message}`);
    process.exit(1);
});
```

### Unix Implementation
For Unix-based systems:

1. **Signal Handling**:
```typescript
process.on('SIGTERM', () => {
    console.error('Received SIGTERM, shutting down...');
    process.exit(0);
});
```

2. **File Permissions**:
```typescript
import { chmod } from 'fs/promises';

await chmod('server.sh', 0o755);
```

## Integration with VS Code

If you're developing an MCP server for VS Code:

1. Follow the standard MCP server implementation.
2. Consider using the VS Code Extension API for deeper integration.
3. Look at examples like Continue, Cody, or other VS Code extensions that implement MCP.
4. Handle workspace-specific configurations.
5. Implement proper error reporting to VS Code's output channels.

## Debugging

For debugging your MCP server:

1. Use console logs to track execution flow.
2. Implement detailed error messages.
3. Use VS Code's debugging features for TypeScript/JavaScript or Python.
4. Test with simple clients first before integrating with more complex systems.

## Resources

- [Official MCP Documentation](https://modelcontextprotocol.io/)
- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [TypeScript SDK GitHub Repository](https://github.com/modelcontextprotocol/typescript-sdk)
- [Python SDK GitHub Repository](https://github.com/modelcontextprotocol/python-sdk)
- [Example MCP Servers Repository](https://github.com/modelcontextprotocol/servers)

---

This guide provides a foundation for building MCP servers. As the ecosystem evolves, new patterns and best practices will emerge. Stay updated with the official documentation and community resources for the latest developments.
