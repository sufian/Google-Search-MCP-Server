@echo off
REM Start Python search server
start "Google Search API" cmd /k "python google_search.py"

REM Start Python link viewer
start "Link Viewer" cmd /k "python link_view.py"

REM Wait a moment for Python servers to initialize
timeout /t 2

REM Start MCP server with environment variables
set GOOGLE_API_KEY=
set SEARCH_ENGINE_ID=
node dist/google-search.js
