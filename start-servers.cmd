@echo off
REM Start Python search server
start "Google Search API" cmd /k "python google_search.py"

REM Start Python link viewer
start "Link Viewer" cmd /k "python link_view.py"

REM Wait a moment for Python servers to initialize
timeout /t 2

REM Start MCP server with environment variables
set GOOGLE_API_KEY=AIzaSyDfkGHk5g4sK89zpzS3fJ6a9GoGnoJh8YU
set SEARCH_ENGINE_ID=96881945019f042be
node dist/google-search.js
