src/shared/mcp-base-agent.ts
    // e.g., "mcp://shale-data/inputs/las-files/**" -> "las-files"
    const parts = uri.replace('mcp://shale-data/', '').split('/');
    if (parts.length >= 2) {
      return parts[parts.length - 1].replace('**', '').replace('*', '');
 Check failure
Code scanning
/ CodeQL

Incomplete string escaping or encoding
High

This replaces only the first occurrence of '*'.
Show more details
Copilot Autofix
AI about 1 hour ago

To fix the problem, we should replace all occurrences of "**" and "*" in the string, not just the first. The best way to do this in JavaScript/TypeScript is to use the replace method with a regular expression and the global flag (g). Specifically, we should replace all occurrences of "**" and "*" with an empty string. This can be done with two separate global replacements, or with a single regular expression that matches both patterns. For clarity and correctness, a single regular expression /\*{1,2}/g will match any sequence of one or two asterisks. Alternatively, if we want to remove all asterisks regardless of how many in a row, /\*/g suffices. The code to change is in the getInputKeyFromUri method, specifically line 157. No new imports are needed.

Suggested changeset 1

src/shared/mcp-base-agent.ts
@@ -154,7 +154,7 @@
    // e.g., "mcp://shale-data/inputs/las-files/**" -> "las-files"
    const parts = uri.replace('mcp://shale-data/', '').split('/');
    if (parts.length >= 2) {
      return parts[parts.length - 1].replace('**', '').replace('*', '');
      return parts[parts.length - 1].replace(/\*/g, '');
    }
    return uri.split('/').pop() || uri;
  }
Copilot is powered by AI and may make mistakes. Always verify output.


{request:r,isTsParent:e,isFilePath:j(r)}),j(r)){const n=S(s,r,e);if(n)return n}try{return s(r)}catch(n){const t=n;if(t.code==="MODULE_NOT_FOUND"){if(t.path){const i=t.message.match(/^Cannot find module '([^']+)'$/);if(i){const f=i[1],l=S(s,f,e);if(l)return l}const c=t.message.match(/^Cannot find module '([^']+)'. Please verify that the package.json has a valid "main" entry$/);if(c){const f=c[1],l=S(s,f,e);if(l)return l}}const a=S(s,r,e);if(a)return a}throw t}},"createTsExtensionResolver"),z="at cjsPreparseModuleExports (node:internal",de=o(s=>{const e=s.stack.split(`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            

Error: Cannot find module './src/mcp.ts'
Require stack:
- /home/runner/work/ShaleYeah/ShaleYeah/[eval]
    at Module._resolveFilename (node:internal/modules/cjs/loader:1212:15)
    at nextResolveSimple (/home/runner/work/ShaleYeah/ShaleYeah/node_modules/tsx/dist/register-D46fvsV_.cjs:4:1004)
    at /home/runner/work/ShaleYeah/ShaleYeah/node_modules/tsx/dist/register-D46fvsV_.cjs:3:2630
    at /home/runner/work/ShaleYeah/ShaleYeah/node_modules/tsx/dist/register-D46fvsV_.cjs:3:1542
    at resolveTsPaths (/home/runner/work/ShaleYeah/ShaleYeah/node_modules/tsx/dist/register-D46fvsV_.cjs:4:760)
    at /home/runner/work/ShaleYeah/ShaleYeah/node_modules/tsx/dist/register-D46fvsV_.cjs:4:1102
    at m._resolveFilename (file:///home/runner/work/ShaleYeah/ShaleYeah/node_modules/tsx/dist/register-B7jrtLTO.mjs:1:789)
    at Module._load (node:internal/modules/cjs/loader:1043:27)
    at Module.require (node:internal/modules/cjs/loader:1298:19)
    at require (node:internal/modules/helpers:182:18) {
  code: 'MODULE_NOT_FOUND',
  requireStack: [ '/home/runner/work/ShaleYeah/ShaleYeah/[eval]' ]
}

Incomplete string escaping or encoding
 In pull request in refs/pull/13/merge 50 minutes ago
Code snippet
src/shared/mcp-base-agent.ts:157 
    // e.g., "mcp://shale-data/inputs/las-files/**" -> "las-files"
    const parts = uri.replace('mcp://shale-data/', '').split('/');
    if (parts.length >= 2) {
      return parts[parts.length - 1].replace('**', '').replace('*', '');
This replaces only the first occurrence of '*'.
CodeQL
    }
    return uri.split('/').pop() || uri;
  }
Rule
Tool
CodeQL
Rule ID
js/incomplete-sanitization
Query
View source

4s
Run npm run type-check

> shale-yeah@0.1.0 type-check
> tsc --noEmit

scripts/test-standards-mcp.ts:37:45 - error TS2339: Property 'name' does not exist on type 'McpServer'.

37     console.log(`✅ Server name: ${mcpServer.name}`);
                                               ~~~~

scripts/test-standards-mcp.ts:38:48 - error TS2339: Property 'version' does not exist on type 'McpServer'.

38     console.log(`✅ Server version: ${mcpServer.version}`);
                                                  ~~~~~~~

scripts/test-wave2-mcp-servers.ts:31:61 - error TS2339: Property 'name' does not exist on type 'McpServer'.

31     console.log(`✅ Server name: ${geologyServer.getServer().name}`);
                                                               ~~~~

scripts/test-wave2-mcp-servers.ts:43:63 - error TS2339: Property 'name' does not exist on type 'McpServer'.

43     console.log(`✅ Server name: ${economicsServer.getServer().name}`);
                                                                 ~~~~

scripts/test-wave2-mcp-servers.ts:55:63 - error TS2339: Property 'name' does not exist on type 'McpServer'.

55     console.log(`✅ Server name: ${reportingServer.getServer().name}`);
                                                                 ~~~~

src/mcp-controller-v2.ts:19:3 - error TS2305: Module '"./shared/types.js"' has no exported member 'MCPAgentResourceConfig'.

19   MCPAgentResourceConfig,
     ~~~~~~~~~~~~~~~~~~~~~~

src/mcp-servers/economics.ts:49:59 - error TS2339: Property 'name' does not exist on type 'McpServer'.

49       console.log(`💰 Economics MCP Server "${this.server.name}" initialized`);
                                                             ~~~~

src/mcp-servers/economics.ts:440:65 - error TS2322: Type 'string[]' is not assignable to type 'ListResourcesCallback'.
  Type 'string[]' provides no match for the signature '(extra: RequestHandlerExtra<ServerRequest, ServerNotification>): { [x: string]: unknown; resources: { [x: string]: unknown; name: string; ... 4 more ...; description?: string | undefined; }[]; _meta?: { ...; } | undefined; nextCursor?: string | undefined; } | Promise<...>'.

440       new ResourceTemplate("economics://models/{model_type}", { list: ["dcf", "risk", "portfolio"] }),
                                                                    ~~~~

  node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.d.ts:170:9
    170         list: ListResourcesCallback | undefined;
                ~~~~
    The expected type comes from property 'list' which is declared here on type '{ list: ListResourcesCallback | undefined; complete?: { [variable: string]: CompleteResourceTemplateCallback; } | undefined; }'

src/mcp-servers/economics.ts:479:64 - error TS2322: Type 'string[]' is not assignable to type 'ListResourcesCallback'.
  Type 'string[]' provides no match for the signature '(extra: RequestHandlerExtra<ServerRequest, ServerNotification>): { [x: string]: unknown; resources: { [x: string]: unknown; name: string; ... 4 more ...; description?: string | undefined; }[]; _meta?: { ...; } | undefined; nextCursor?: string | undefined; } | Promise<...>'.

479       new ResourceTemplate("economics://market/{commodity}", { list: ["oil", "gas", "ngl"] }),
                                                                   ~~~~

  node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.d.ts:170:9
    170         list: ListResourcesCallback | undefined;
                ~~~~
    The expected type comes from property 'list' which is declared here on type '{ list: ListResourcesCallback | undefined; complete?: { [variable: string]: CompleteResourceTemplateCallback; } | undefined; }'

src/mcp-servers/geology.ts:49:57 - error TS2339: Property 'name' does not exist on type 'McpServer'.

49       console.log(`🗻 Geology MCP Server "${this.server.name}" initialized`);
                                                           ~~~~

src/mcp-servers/geology.ts:272:71 - error TS2322: Type 'string[]' is not assignable to type 'ListResourcesCallback'.
  Type 'string[]' provides no match for the signature '(extra: RequestHandlerExtra<ServerRequest, ServerNotification>): { [x: string]: unknown; resources: { [x: string]: unknown; name: string; ... 4 more ...; description?: string | undefined; }[]; _meta?: { ...; } | undefined; nextCursor?: string | undefined; } | Promise<...>'.

272       new ResourceTemplate("geology://formations/{formation_name}", { list: ["bakken", "three_forks", "birdbear"] }),
                                                                          ~~~~

  node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.d.ts:170:9
    170         list: ListResourcesCallback | undefined;
                ~~~~
    The expected type comes from property 'list' which is declared here on type '{ list: ListResourcesCallback | undefined; complete?: { [variable: string]: CompleteResourceTemplateCallback; } | undefined; }'

src/mcp-servers/geology.ts:346:57 - error TS2322: Type 'string[]' is not assignable to type 'ListResourcesCallback'.
  Type 'string[]' provides no match for the signature '(extra: RequestHandlerExtra<ServerRequest, ServerNotification>): { [x: string]: unknown; resources: { [x: string]: unknown; name: string; ... 4 more ...; description?: string | undefined; }[]; _meta?: { ...; } | undefined; nextCursor?: string | undefined; } | Promise<...>'.

346       new ResourceTemplate("geology://zones/geojson", { list: ["zones.geojson"] }),
                                                            ~~~~

  node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.d.ts:170:9
    170         list: ListResourcesCallback | undefined;
                ~~~~
    The expected type comes from property 'list' which is declared here on type '{ list: ListResourcesCallback | undefined; complete?: { [variable: string]: CompleteResourceTemplateCallback; } | undefined; }'

src/mcp-servers/geology.ts:436:40 - error TS2339: Property 'join' does not exist on type 'string | never[]'.
  Property 'join' does not exist on type 'string'.

436 TARGET FORMATIONS: ${target_formations.join(", ") || "All available"}
                                           ~~~~

src/mcp-servers/reporting.ts:49:59 - error TS2339: Property 'name' does not exist on type 'McpServer'.

49       console.log(`📊 Reporting MCP Server "${this.server.name}" initialized`);
                                                             ~~~~

src/mcp-servers/reporting.ts:345:70 - error TS2345: Argument of type 'string | string[]' is not assignable to parameter of type 'string'.
  Type 'string[]' is not assignable to type 'string'.

345         const reportPath = path.join(this.dataPath, 'final-reports', report_name);
                                                                         ~~~~~~~~~~~

src/mcp-servers/reporting.ts:371:71 - error TS2322: Type 'string[]' is not assignable to type 'ListResourcesCallback'.
  Type 'string[]' provides no match for the signature '(extra: RequestHandlerExtra<ServerRequest, ServerNotification>): { [x: string]: unknown; resources: { [x: string]: unknown; name: string; ... 4 more ...; description?: string | undefined; }[]; _meta?: { ...; } | undefined; nextCursor?: string | undefined; } | Promise<...>'.

371       new ResourceTemplate("reporting://templates/{template_type}", { list: ["executive", "detailed", "technical", "qc"] }),
                                                                          ~~~~

  node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.d.ts:170:9
    170         list: ListResourcesCallback | undefined;
                ~~~~
    The expected type comes from property 'list' which is declared here on type '{ list: ListResourcesCallback | undefined; complete?: { [variable: string]: CompleteResourceTemplateCallback; } | undefined; }'

src/shared/agent-factory.ts:6:42 - error TS2305: Module '"./types.js"' has no exported member 'MCPAgentResourceConfig'.

6 import type { AgentPersona, AgentConfig, MCPAgentResourceConfig } from './types.js';
                                           ~~~~~~~~~~~~~~~~~~~~~~

src/shared/agent-factory.ts:73:15 - error TS2445: Property 'persona' is protected and only accessible within class 'BaseAgent' and its subclasses.

73         agent.persona.name,
                 ~~~~~~~

src/shared/agent-factory.ts:96:57 - error TS2445: Property 'persona' is protected and only accessible within class 'BaseAgent' and its subclasses.

96     console.info(`🏭 Agent factory initialized: ${agent.persona.name} (${config.runId})`);
                                                           ~~~~~~~

src/shared/agent-factory.ts:137:19 - error TS2511: Cannot create an instance of an abstract class.

137     const agent = new BaseAgent(config.runId, config.outputDir, yamlConfig.name, persona, config.modeOverride);
                      ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/shared/mcp-base-agent.ts:9:3 - error TS2305: Module '"./types.js"' has no exported member 'MCPResourceClient'.

9   MCPResourceClient,
    ~~~~~~~~~~~~~~~~~

src/shared/mcp-base-agent.ts:10:3 - error TS2305: Module '"./types.js"' has no exported member 'MCPResourceDependency'.

10   MCPResourceDependency,
     ~~~~~~~~~~~~~~~~~~~~~

src/shared/mcp-base-agent.ts:11:3 - error TS2305: Module '"./types.js"' has no exported member 'MCPAgentResourceConfig'.

11   MCPAgentResourceConfig
     ~~~~~~~~~~~~~~~~~~~~~~

src/shared/mcp-base-agent.ts:105:34 - error TS7006: Parameter 'resource' implicitly has an 'any' type.

105             resources.map(async (resource) => ({
                                     ~~~~~~~~

src/shared/mcp-pipeline-state.ts:24:9 - error TS2416: Property 'getCurrentState' in type 'MCPPipelineStateManager' is not assignable to the same property in base type 'PipelineStateManager'.
  Type '() => Promise<PipelineState>' is not assignable to type '() => PipelineState'.
    Type 'Promise<PipelineState>' is not assignable to type 'PipelineState'.

24   async getCurrentState(): Promise<PipelineState> {
           ~~~~~~~~~~~~~~~

src/shared/mcp-pipeline-state.ts:30:14 - error TS1361: 'PipelineState' cannot be used as a value because it was imported using 'import type'.

30       return PipelineState.INITIALIZING;
                ~~~~~~~~~~~~~

  src/shared/mcp-pipeline-state.ts:7:3
    7   PipelineState,
        ~~~~~~~~~~~~~
    'PipelineState' was imported here.

src/shared/mcp-pipeline-state.ts:75:50 - error TS7006: Parameter 'name' implicitly has an 'any' type.

75     agentStatus.ready = agentStatus.ready.filter(name => name !== agentName);
                                                    ~~~~

src/shared/mcp-pipeline-state.ts:123:35 - error TS2504: Type 'AsyncIterator<MCPResourceEvent, any, any>' must have a '[Symbol.asyncIterator]()' method that returns an async iterator.

123         for await (const event of this.server.watchResource(this.stateUri)) {
                                      ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/shared/mcp-resource-client.ts:62:35 - error TS2504: Type 'AsyncIterator<MCPResourceEvent, any, any>' must have a '[Symbol.asyncIterator]()' method that returns an async iterator.

62         for await (const event of this.server.watchResource(uri)) {
                                     ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/shared/standards-mcp-client.ts:6:24 - error TS2307: Cannot find module '@modelcontextprotocol/sdk/client' or its corresponding type declarations.
  There are types at '/home/runner/work/ShaleYeah/ShaleYeah/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.d.ts', but this result could not be resolved under your current 'moduleResolution' setting. Consider updating to 'node16', 'nodenext', or 'bundler'.

6 import { Client } from '@modelcontextprotocol/sdk/client';
                         ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/shared/standards-mcp-server.ts:45:59 - error TS2339: Property 'name' does not exist on type 'McpServer'.

45       console.log(`📡 Standards MCP Server "${this.server.name}" initialized`);
                                                             ~~~~

src/shared/standards-mcp-server.ts:177:62 - error TS2322: Type 'string[]' is not assignable to type 'ListResourcesCallback'.
  Type 'string[]' provides no match for the signature '(extra: RequestHandlerExtra<ServerRequest, ServerNotification>): { [x: string]: unknown; resources: { [x: string]: unknown; name: string; ... 4 more ...; description?: string | undefined; }[]; _meta?: { ...; } | undefined; nextCursor?: string | undefined; } | Promise<...>'.

177       new ResourceTemplate("geological://data/{filename}", { list: ["formations.json", "curves.json", "analysis.json"] }),
                                                                 ~~~~

  node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.d.ts:170:9
    170         list: ListResourcesCallback | undefined;
                ~~~~
    The expected type comes from property 'list' which is declared here on type '{ list: ListResourcesCallback | undefined; complete?: { [variable: string]: CompleteResourceTemplateCallback; } | undefined; }'

src/shared/standards-mcp-server.ts:183:66 - error TS2345: Argument of type 'string | string[]' is not assignable to parameter of type 'string'.
  Type 'string[]' is not assignable to type 'string'.

183         const filePath = path.join(this.resourceRoot, 'outputs', filename);
                                                                     ~~~~~~~~

src/shared/standards-mcp-server.ts:215:78 - error TS2345: Argument of type 'string | string[]' is not assignable to parameter of type 'string'.
  Type 'string[]' is not assignable to type 'string'.

215         const filePath = path.join(this.resourceRoot, 'inputs', 'las-files', filename);
                                                                                 ~~~~~~~~

src/shared/yaml-config-loader.ts:9:28 - error TS2305: Module '"./types.js"' has no exported member 'MCPAgentResourceConfig'.

9 import type { AgentConfig, MCPAgentResourceConfig } from './types.js';
                             ~~~~~~~~~~~~~~~~~~~~~~

src/shared/yaml-config-loader.ts:78:29 - error TS2345: Argument of type 'string | Buffer<ArrayBufferLike>' is not assignable to parameter of type 'string'.
  Type 'Buffer<ArrayBufferLike>' is not assignable to type 'string'.

78       let data = YAML.parse(content);
                               ~~~~~~~

src/unified-mcp-client.ts:47:11 - error TS2564: Property 'resourceRoot' has no initializer and is not definitely assigned in the constructor.

47   private resourceRoot: string;
             ~~~~~~~~~~~~


Found 37 errors in 14 files.

Errors  Files
     2  scripts/test-standards-mcp.ts:37
     3  scripts/test-wave2-mcp-servers.ts:31
     1  src/mcp-controller-v2.ts:19
     3  src/mcp-servers/economics.ts:49
     4  src/mcp-servers/geology.ts:49
     3  src/mcp-servers/reporting.ts:49
     4  src/shared/agent-factory.ts:6
     4  src/shared/mcp-base-agent.ts:9
     4  src/shared/mcp-pipeline-state.ts:24
     1  src/shared/mcp-resource-client.ts:62
     1  src/shared/standards-mcp-client.ts:6
     4  src/shared/standards-mcp-server.ts:45
     2  src/shared/yaml-config-loader.ts:9
     1  src/unified-mcp-client.ts:47

