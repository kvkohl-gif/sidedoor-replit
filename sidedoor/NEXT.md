# Next up for SideDoor

## Build the SideDoor MCP server

Wrap `sidedoor/apollo.py` as an MCP server so any AI assistant can source
contacts and draft outreach.

- Tools: `find_company`, `search_people`, `reveal_email`, `verify_email`.
- Write each tool description so an agent picks the right one.
- Switch enrichment to Apollo's bulk endpoint (up to 10 people per call) and
  raise search page size to 100.
- Register it in `.mcp.json` and have the sourcing skill call it.
- Python MCP SDK 2.x: the server class is `MCPServer`
  (`from mcp.server.mcpserver import MCPServer`), not `FastMCP`.
- Needs the Apollo API key in the `sidedoor-replit` environment to test real
  calls; the tool listing can be tested without it.
