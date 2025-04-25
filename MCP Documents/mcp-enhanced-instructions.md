# Instructions for LLM:

You are an expert software development assistant. Your task is to provide a detailed plan and guidance for building a Windows desktop application according to the user's requirements.

## User Goal:
Create a Windows desktop application that allows a user to have a text-based conversation with Google's Gemini Flash 2.0 model via the Google Gemini API, while also supporting Anthropic's Model Context Protocol (MCP) for enhanced contextual capabilities. The application should support requests for image generation from Gemini and allow the user to save the generated images locally, preferably in the chat window as part of the conversation.

## Core Requirements:

- **Platform**: Windows Desktop.

- **Functionality**:
  - Chat interface for conversation with Gemini Flash 2.0.
  - Integration with Anthropic's Model Context Protocol (MCP) for accessing external data sources and tools.
  - Ability to request image generation within the conversation.
  - Display generated images within the application.
  - Save generated images to the user's local machine.

- **APIs**: 
  - Google Gemini API for text and image generation
  - Model Context Protocol (MCP) support for connecting to data sources and tools

- **Models**: 
  - Gemini Flash 2.0 (or latest appropriate Flash model).
  - Support for MCP-compatible models

- **Technology**: User suggested Node.js, React, Three.js but is open. We will recommend Electron with Node.js and potentially React for the UI, as this fits the desktop requirement and leverages JavaScript expertise.

## Recommended Technology Stack:

- **Framework**: Electron (Allows building cross-platform desktop apps with web technologies - HTML, CSS, JavaScript).

- **Backend Logic (Main Process)**: Node.js (Runs within Electron's main process, handles API calls, file system operations). 

- **Frontend UI (Renderer Process)**: HTML, CSS, JavaScript. Optionally, use React for building the user interface components, as suggested by the user and well-supported within Electron. 

- **API Interactions**:
  - Official Google Generative AI SDK for JavaScript (@google/generative-ai)
  - Model Context Protocol SDKs (@anthropic/mcp-sdk or official TypeScript/JavaScript SDK)

## Detailed Plan & Steps:

### Phase 1: Setup and Basic Structure

#### Environment Setup:

- Ensure Node.js and npm (or yarn) are installed.
- Obtain a Google Gemini API Key from Google AI Studio. Store this key securely.
- If using Anthropic's Claude models via MCP, obtain necessary API credentials.

#### Project Initialization:

- Create a new project directory.
- Initialize npm: `npm init -y`
- Install Electron: `npm install --save-dev electron`
- Optional (If using React): Use a template like electron-vite with React or manually set up create-react-app and integrate it with Electron. Install React dependencies: `npm install react react-dom`.
- Install the Google AI SDK: `npm install @google/generative-ai`
- Install the MCP SDK: `npm install @anthropic/mcp-client` (or official MCP TypeScript SDK)
- Install dotenv for API key management: `npm install dotenv`

#### Electron Basic Structure:

- Create the main process entry file (e.g., main.js or src/electron/main.js). This Node.js script creates the application window (BrowserWindow) and handles system events.
- Create the renderer process files (e.g., index.html, renderer.js, style.css or React components if using React). This is the web page displayed within the Electron window.
- Configure package.json: Set the main field to your main process file and add a script to start Electron (e.g., "start": "electron .").
- Establish Inter-Process Communication (IPC) using ipcMain (in main.js) and ipcRenderer (in renderer.js or React components) for communication between the frontend and backend.

### Phase 2: UI Development

#### Design the UI (Renderer Process):

- Create the chat interface layout using HTML and CSS (or React components).
- Include:
  - A display area for chat messages (user, Gemini, and MCP-enhanced responses).
  - An input field for the user to type messages.
  - A "Send" button.
  - A tool/context selector for choosing between Gemini and MCP servers.
  - An area to display generated images.
  - A "Save Image" button (initially hidden or disabled).

### Phase 3: MCP Integration

#### Setup MCP Client:

- In the main process, create MCP client initialization logic:
```javascript
const { createClient } = require('@anthropic/mcp-client'); // or equivalent SDK

// Initialize MCP client
const mcpClient = createClient({
  // Configure with appropriate options
});
```

#### Implement MCP Server Discovery & Connections:

- Create a mechanism to discover and connect to local MCP servers.
- Implement a configuration system to store MCP server settings:
```javascript
// Example MCP server configuration in settings.json
const mcpServerConfig = {
  "fileSystem": {
    "command": "node",
    "args": ["./mcp-servers/filesystem-server.js"]
  },
  "database": {
    "command": "node",
    "args": ["./mcp-servers/database-server.js"]
  }
};
```

#### Create Process Management for MCP Servers:

- Implement a system to start/stop MCP server processes.
- Handle IPC messages to manage these servers from the UI.

#### Implement MCP Tool Calls:

- Create a mechanism for sending tool requests to MCP servers.
- Handle responses and integrate them into the chat flow.
```javascript
async function callMCPTool(serverName, toolName, params) {
  const server = mcpClient.connectToServer(serverName);
  const toolResponse = await server.callTool(toolName, params);
  return toolResponse;
}
```

### Phase 4: Gemini API Integration (Text)

#### Setup Gemini Client (Main Process):

- In main.js, import and initialize the @google/generative-ai SDK using your API key (loaded securely via dotenv).
- Specify the gemini-1.5-flash-latest model (or check documentation for the exact identifier for Gemini Flash 2.0 when available).

#### Implement Text Chat Logic:

- Renderer: When the user clicks "Send", capture the input text and send it to the main process via IPC (e.g., ipcRenderer.send('send-message', userText)).
- Main Process: Set up an ipcMain.on('send-message', ...) listener.
- Inside the listener:
  - Determine whether to use Gemini API directly or route through MCP based on user selection/context.
  - For Gemini direct use: Call the Gemini API using the SDK's generateContent method with the user's text prompt.
  - For MCP-enhanced use: Transform the Gemini "tool calling" format to MCP format and use appropriate MCP servers.
  - Handle the asynchronous response.
  - Send the response back to the renderer process via IPC.
- Renderer: Display the received response in the chat display area.

### Phase 5: Bridge Gemini Tool Calling with MCP

#### Create MCP-to-Gemini Adapter:

- Implement a mechanism to translate between Gemini's tool calling format and MCP's protocol:
```javascript
function adaptGeminiToolCallToMCP(geminiToolCall) {
  // Transform Gemini tool call format to MCP format
  const mcpToolCall = {
    name: geminiToolCall.name,
    parameters: geminiToolCall.parameters
    // Add other necessary MCP fields
  };
  return mcpToolCall;
}

function adaptMCPResponseToGemini(mcpResponse) {
  // Transform MCP response format to Gemini format
  const geminiResponse = {
    // Format appropriately for Gemini
  };
  return geminiResponse;
}
```

### Phase 6: Gemini API Integration (Image Generation)

#### Implement Image Generation Request:

- Determine Trigger: Decide how the user requests an image (e.g., specific keywords in the prompt like "generate an image of...", a separate button, etc.).
- Renderer: When an image request is detected, send the prompt to the main process via IPC.
- Main Process: Handle image generation requests.
- Call the Gemini API using the SDK. Check the Gemini API documentation for the exact model and parameters needed for image generation.

#### Process Image Response (Main Process):

- Extract the image data (Base64, URL, etc.) based on the response format.
- If it returns a URL, use Node.js's built-in fetch or libraries like axios to download the image data.

#### Display Image (Renderer Process):

- Main Process: Send the image data back to the renderer process via IPC.
- Renderer: Display the image in the designated image display area.
- Enable the "Save Image" button.

### Phase 7: Image Saving

#### Implement Image Saving:

- Renderer: Add an event listener to the "Save Image" button. When clicked, send a request to the main process via IPC.
- Main Process: Set up an IPC listener for save requests.
- Use Electron's dialog.showSaveDialog method to prompt the user for a file path and name.
- Save the image data to the selected file path.
- Optionally, send a confirmation or error message back to the renderer.

### Phase 8: MCP Server Implementation Examples

#### Implement Example MCP Servers:

- Create a directory for MCP server implementations.
- Implement basic servers for common use cases:

1. **File System MCP Server**:
```javascript
const { Server, Tool } = require('@anthropic/mcp-server'); // or equivalent SDK

const app = new Server("filesystem-server");

// List tools
app.listTools(() => [
  new Tool({
    name: "read_file",
    description: "Read content from a file",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to the file" }
      },
      required: ["path"]
    }
  }),
  new Tool({
    name: "write_file",
    description: "Write content to a file",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to the file" },
        content: { type: "string", description: "Content to write" }
      },
      required: ["path", "content"]
    }
  })
]);

// Implement tool handlers
app.handleTool("read_file", async ({ path }) => {
  const fs = require('fs').promises;
  const content = await fs.readFile(path, 'utf-8');
  return { content };
});

app.handleTool("write_file", async ({ path, content }) => {
  const fs = require('fs').promises;
  await fs.writeFile(path, content, 'utf-8');
  return { success: true };
});

// Start the server
app.start();
```

2. **Database MCP Server**:
```javascript
// Similar structure for database access
```

### Phase 9: Refinement and Packaging

#### Error Handling:
- Implement robust error handling for API calls, MCP interactions, file operations, and IPC communication.

#### Packaging:
- Use tools like electron-builder or electron-packager to bundle the application into a distributable Windows executable (.exe).
- Configure package.json with necessary build settings (app ID, icons, etc.).

## Important Considerations:

### API Key Security:
- The Gemini API key and any Anthropic API credentials must be kept secure and not embedded directly in client-side/renderer code. Use environment variables loaded in the main process.

### Gemini-MCP Interoperability:
- Gemini and MCP use different formats for tool calling. Create adapters to translate between these formats.
- Document clearly how the two systems interact within your application.

### MCP Server Management:
- MCP servers typically run as separate processes. Implement proper process management to start/stop these servers as needed.
- Consider resource usage and ensure servers are properly terminated when the application closes.

### Asynchronous Operations:
- Most operations (API calls, MCP interactions, file I/O, IPC) are asynchronous. Use async/await or Promises correctly.

### Rate Limits:
- Be mindful of Gemini API usage limits and costs.
- Implement appropriate rate limiting for MCP server calls.

### Documentation:
- Provide clear documentation on how to configure and use MCP servers within your application.
- Explain the differences between using Gemini directly vs. through MCP.
