/**
 * Agent tools: MCP wrappers exposed to the LLM as function tools
 */

import type { ToolDef } from './llm/provider.js';
import type { TaskPackEditorWrapper } from './mcpWrappers.js';
import * as browserInspector from './browserInspector.js';

/** OpenAI-format tool definitions: Editor MCP + Browser MCP (always on) */
export const MCP_AGENT_TOOL_DEFINITIONS: ToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'editor_list_packs',
      description: 'List all JSON Task Packs (id, name, version, description). Call when user asks about packs.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'editor_read_pack',
      description: 'Read a pack: returns taskpack.json and flow.json. MUST call first when packId is provided before proposing any flow changes.',
      parameters: {
        type: 'object',
        properties: { packId: { type: 'string', description: 'Pack ID' } },
        required: ['packId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'editor_validate_flow',
      description: 'Validate flow JSON text (DSL steps and collectibles). Returns ok, errors, warnings.',
      parameters: {
        type: 'object',
        properties: { flowJsonText: { type: 'string', description: 'Flow JSON as string' } },
        required: ['flowJsonText'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'editor_apply_flow_patch',
      description:
        'Apply ONE patch to flow.json. Pass flat params: packId, op, and for the op: index?, step?, collectibles? at top level (no nested patch object). append: op + step. insert: op + index + step. replace: op + index + step. delete: op + index. update_collectibles: op + collectibles. Step = { id, type, params }. Templating: Nunjucks ({{inputs.x}}, {{vars.x}}; use {{ inputs.x | urlencode }} for URL/query values). Supported types: navigate, wait_for, click, fill, extract_text, extract_attribute, extract_title, sleep, assert, set_var, network_find (where, pick, saveAs; waitForMs), network_replay (requestId MUST be a template like {{vars.<saveAs>}} where <saveAs> is the variable from the preceding network_find step—never use a literal request ID), network_extract (fromVar, as, out).',
      parameters: {
        type: 'object',
        properties: {
          packId: { type: 'string', description: 'Pack ID' },
          op: {
            type: 'string',
            enum: ['append', 'insert', 'replace', 'delete', 'update_collectibles'],
            description: 'append=add step at end; insert=add at index; replace=replace step at index; delete=remove at index; update_collectibles=replace collectibles array',
          },
          index: { type: 'number', description: 'Required for insert, replace, delete. Step index (0-based).' },
          step: {
            type: 'object',
            description: 'Step object { id, type, params }. Required for append, insert, replace.',
          },
          collectibles: {
            type: 'array',
            description: 'Required for update_collectibles. Array of { name, type, description }.',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                type: { type: 'string' },
                description: { type: 'string' },
              },
            },
          },
        },
        required: ['packId', 'op'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'editor_run_pack',
      description:
        'Run a task pack in a separate harness with given inputs. Returns runId, runDir, eventsPath, artifactsDir. Do not use for "run flow in the browser" or "execute steps in the open browser"—use browser_* tools (browser_goto, browser_click, browser_type, etc.) to execute steps in the current browser session instead.',
      parameters: {
        type: 'object',
        properties: {
          packId: { type: 'string' },
          inputs: { type: 'object', description: 'Input values object' },
        },
        required: ['packId', 'inputs'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_start_session',
      description: 'Start a headful browser session for inspection. Returns sessionId. Call when user wants to use browser or no session exists.',
      parameters: {
        type: 'object',
        properties: { headful: { type: 'boolean', description: 'Default true' } },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_goto',
      description: 'Navigate browser to URL. Requires sessionId.',
      parameters: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          url: { type: 'string' },
        },
        required: ['sessionId', 'url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_go_back',
      description: 'Navigate the browser back one step in history. Use when the user asks to go back.',
      parameters: {
        type: 'object',
        properties: { sessionId: { type: 'string' } },
        required: ['sessionId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_type',
      description: 'Type text into an input field. Use label for the accessible name of the field (e.g. "Search", "Email") or selector. Clears the field by default before typing.',
      parameters: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          text: { type: 'string', description: 'Text to type' },
          label: { type: 'string', description: 'Accessible name/label of the input (e.g. "Search")' },
          selector: { type: 'string', description: 'CSS selector when label is not enough' },
          clear: { type: 'boolean', description: 'Clear field before typing (default true)' },
        },
        required: ['sessionId', 'text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_screenshot',
      description: 'Take a screenshot of the current page. Returns { imageBase64, mimeType, url, timestamp }. When you need page context (e.g. user asks "what page am I on?", "what buttons do you see?", "look at the page"), call this first; the image will be attached for you to analyze.',
      parameters: {
        type: 'object',
        properties: { sessionId: { type: 'string' } },
        required: ['sessionId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_get_links',
      description: 'Get all links on the current page (href, visible text, title). Use this to find which link to click instead of screenshot + vision; cheaper and accurate.',
      parameters: {
        type: 'object',
        properties: { sessionId: { type: 'string' } },
        required: ['sessionId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_click',
      description: 'Click an element on the page. Use linkText for the visible text. Use role: "link" for links, "button" for buttons, "text" for other clickables (batch names, tabs, list items, divs/spans). If the item is not a link or button (e.g. "Winter 2026" in a filter), use role "text".',
      parameters: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          linkText: { type: 'string', description: 'Visible text of the element to click (e.g. "Sign in", "Winter 2026")' },
          role: { type: 'string', enum: ['link', 'button', 'text'], description: 'Use "link" (default) for <a>, "button" for buttons, "text" for divs/spans/list items (batch names, tabs)' },
          selector: { type: 'string', description: 'CSS selector if linkText is not sufficient' },
        },
        required: ['sessionId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_network_list',
      description: 'List recent network requests (redacted). Use filter "api" or "xhr" to see likely API calls.',
      parameters: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          limit: { type: 'number', description: 'Default 50' },
          filter: { type: 'string', enum: ['all', 'api', 'xhr'], description: 'Default all' },
        },
        required: ['sessionId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_network_search',
      description: 'Search network requests by query (case-insensitive). Matches URL, method, resourceType, status, request/response headers, postData, and response body. Use this to find requests by company name, text in the response, or URL. Returns matching entries (capped at 20). Prefer over network_list when the user asks for a specific request or content (e.g. "request that contains Martini").',
      parameters: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          query: { type: 'string', description: 'Substring to match in URL, headers, postData, or response body (case-insensitive)' },
          limit: { type: 'number', description: 'Max results to return (default 20)' },
        },
        required: ['sessionId', 'query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_network_get',
      description: 'Get one network request by id (metadata only; no response body). Use when the user provides a request ID (e.g. from the Network list). Call browser_network_get_response when you need the response body. replayPossible indicates replay with browser context is possible.',
      parameters: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          requestId: { type: 'string', description: 'Request ID the user selected (e.g. req-1-123)' },
        },
        required: ['sessionId', 'requestId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_network_get_response',
      description: 'Get the response body for a request. Returns first 200 characters by default; set full=true to return the full captured snippet (up to 2000 chars).',
      parameters: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          requestId: { type: 'string', description: 'Request ID from network list or network_get' },
          full: { type: 'boolean', description: 'If true, return full captured snippet (up to 2000 chars); default false returns first 200 chars' },
        },
        required: ['sessionId', 'requestId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_network_replay',
      description: 'Replay a captured request using the browser context (cookies apply). Overrides: url, setQuery, setHeaders, body (Nunjucks: {{inputs.x}}, {{vars.x}}; use {{ inputs.x | urlencode }} for URL/query values). Optional urlReplace/bodyReplace: { find, replace }; replace can use $1, $2 and Nunjucks (e.g. {{inputs.page | urlencode }}). Returns status, contentType, and bounded response body.',
      parameters: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          requestId: { type: 'string', description: 'Request ID from network list or network_get' },
          overrides: {
            type: 'object',
            description: 'Optional overrides (url, setQuery, setHeaders, body; or urlReplace/bodyReplace { find, replace })',
            properties: {
              url: { type: 'string' },
              setQuery: { type: 'object', description: 'Query params to set (merge/replace)' },
              setHeaders: { type: 'object', description: 'Non-sensitive headers only' },
              body: { type: 'string' },
              urlReplace: { type: 'object', properties: { find: { type: 'string' }, replace: { type: 'string' } }, description: 'Regex find/replace on captured URL' },
              bodyReplace: { type: 'object', properties: { find: { type: 'string' }, replace: { type: 'string' } }, description: 'Regex find/replace on captured body' },
            },
          },
        },
        required: ['sessionId', 'requestId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_network_clear',
      description: 'Clear the session network buffer.',
      parameters: {
        type: 'object',
        properties: { sessionId: { type: 'string' } },
        required: ['sessionId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_last_actions',
      description: 'Get recent actions performed in the browser session.',
      parameters: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          limit: { type: 'number', description: 'Default 10' },
        },
        required: ['sessionId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_close_session',
      description: 'Close the browser session and free resources.',
      parameters: {
        type: 'object',
        properties: { sessionId: { type: 'string' } },
        required: ['sessionId'],
      },
    },
  },
];

export interface AgentToolContext {
  taskPackEditor: TaskPackEditorWrapper;
  /** Current browser session ID (optional; agent may start one via start_session) */
  browserSessionId?: string | null;
}

/** Strip editor_ or browser_ prefix for internal dispatch (OpenAI allows only [a-zA-Z0-9_-] in tool names) */
function toolNameToInternal(name: string): string {
  if (name.startsWith('editor_')) return name.slice(7);
  if (name.startsWith('browser_')) return name.slice(8);
  return name;
}

/** Result of executing a tool: string for LLM, optional browser snapshot for HTTP response */
export interface ExecuteToolResult {
  stringForLlm: string;
  browserSnapshot?: { screenshotBase64: string; mimeType: string; url: string };
}

/**
 * Execute one agent tool by name (editor.* or browser.*) with parsed arguments.
 * Returns string for LLM and optional browser snapshot for response.
 */
export async function executeAgentTool(
  name: string,
  args: Record<string, unknown>,
  ctx: AgentToolContext
): Promise<ExecuteToolResult> {
  const { taskPackEditor } = ctx;
  const internal = toolNameToInternal(name);

  const wrap = (
    s: string,
    snapshot?: { screenshotBase64: string; mimeType: string; url: string }
  ): ExecuteToolResult => (snapshot ? { stringForLlm: s, browserSnapshot: snapshot } : { stringForLlm: s });

  try {
    switch (internal) {
      case 'list_packs': {
        const result = await taskPackEditor.listPacks();
        return wrap(JSON.stringify(result, null, 2));
      }
      case 'read_pack': {
        const packId = args.packId as string;
        if (!packId) throw new Error('packId required');
        const result = await taskPackEditor.readPack(packId);
        return wrap(JSON.stringify(result, null, 2));
      }
      case 'validate_flow': {
        const flowJsonText = args.flowJsonText as string;
        if (typeof flowJsonText !== 'string') throw new Error('flowJsonText required');
        const result = await taskPackEditor.validateFlow(flowJsonText);
        return wrap(JSON.stringify(result, null, 2));
      }
      case 'apply_flow_patch': {
        const packId = args.packId as string;
        if (!packId) throw new Error('packId required');
        // Accept flat params (packId, op, index?, step?, collectibles?) or legacy nested patch
        const legacyPatch = args.patch as Record<string, unknown> | undefined;
        const patch: Record<string, unknown> = legacyPatch
          ? { ...legacyPatch }
          : {
              op: args.op,
              ...(args.index !== undefined && { index: args.index }),
              ...(args.step !== undefined && { step: args.step }),
              ...(args.collectibles !== undefined && { collectibles: args.collectibles }),
            };
        if (!patch.op) throw new Error('op required (append, insert, replace, delete, or update_collectibles)');
        const result = await taskPackEditor.applyFlowPatch(packId, patch as any);
        return wrap(JSON.stringify(result, null, 2));
      }
      case 'run_pack': {
        const packId = args.packId as string;
        const inputs = (args.inputs as Record<string, unknown>) || {};
        if (!packId) throw new Error('packId required');
        const result = await taskPackEditor.runPack(packId, inputs);
        return wrap(JSON.stringify(result, null, 2));
      }
      case 'start_session': {
        const headful = args.headful !== false;
        const sessionId = await browserInspector.startBrowserSession(headful);
        return wrap(JSON.stringify({ sessionId }, null, 2));
      }
      case 'close_session': {
        const sessionId = args.sessionId as string;
        if (!sessionId) throw new Error('sessionId required');
        await browserInspector.closeSession(sessionId);
        return wrap(JSON.stringify({ success: true }, null, 2));
      }
      case 'goto': {
        const sessionId = args.sessionId as string;
        const url = args.url as string;
        if (!sessionId || !url) throw new Error('sessionId and url required');
        const currentUrl = await browserInspector.gotoUrl(sessionId, url);
        return wrap(JSON.stringify({ url: currentUrl }, null, 2));
      }
      case 'go_back': {
        const sessionId = args.sessionId as string;
        if (!sessionId) throw new Error('sessionId required');
        const result = await browserInspector.goBack(sessionId);
        return wrap(JSON.stringify(result, null, 2));
      }
      case 'type': {
        const sessionId = args.sessionId as string;
        const text = args.text as string;
        if (!sessionId || text === undefined) throw new Error('sessionId and text required');
        const label = args.label as string | undefined;
        const selector = args.selector as string | undefined;
        if (!label && !selector) throw new Error('label or selector required');
        const result = await browserInspector.typeInElement(sessionId, {
          text,
          label,
          selector,
          clear: args.clear !== false,
        });
        return wrap(JSON.stringify(result, null, 2));
      }
      case 'click': {
        const sessionId = args.sessionId as string;
        if (!sessionId) throw new Error('sessionId required');
        const linkText = args.linkText as string | undefined;
        const selector = args.selector as string | undefined;
        const role = (args.role as 'link' | 'button' | 'text') || 'link';
        if (!linkText && !selector) throw new Error('linkText or selector required');
        const result = await browserInspector.clickElement(sessionId, { linkText, selector, role });
        return wrap(JSON.stringify(result, null, 2));
      }
      case 'screenshot': {
        const sessionId = args.sessionId as string;
        if (!sessionId) throw new Error('sessionId required');
        const result = await browserInspector.takeScreenshot(sessionId);
        return wrap(
          JSON.stringify(
            {
              url: result.url,
              timestamp: result.timestamp,
              mimeType: result.mimeType,
              imageAttached: true,
              note: 'Screenshot captured. Image is attached in the next message for analysis.',
            },
            null,
            2
          ),
          { screenshotBase64: result.imageBase64, mimeType: result.mimeType, url: result.url }
        );
      }
      case 'get_links': {
        const sessionId = args.sessionId as string;
        if (!sessionId) throw new Error('sessionId required');
        const result = await browserInspector.getLinks(sessionId);
        return wrap(JSON.stringify(result, null, 2));
      }
      case 'network_list': {
        const sessionId = args.sessionId as string;
        if (!sessionId) throw new Error('sessionId required');
        const limit = (args.limit as number) ?? 50;
        const filter = (args.filter as 'all' | 'api' | 'xhr') ?? 'all';
        const list = browserInspector.networkList(sessionId, limit, filter);
        return wrap(JSON.stringify(list, null, 2));
      }
      case 'network_search': {
        const sessionId = args.sessionId as string;
        const query = args.query as string;
        if (!sessionId || query == null) throw new Error('sessionId and query required');
        const limit = (args.limit as number) ?? 20;
        const list = browserInspector.networkSearch(sessionId, query, limit);
        return wrap(JSON.stringify(list, null, 2));
      }
      case 'network_get': {
        const sessionId = args.sessionId as string;
        const requestId = args.requestId as string;
        if (!sessionId || !requestId) throw new Error('sessionId and requestId required');
        const result = browserInspector.networkGet(sessionId, requestId);
        return wrap(JSON.stringify(result, null, 2));
      }
      case 'network_get_response': {
        const sessionId = args.sessionId as string;
        const requestId = args.requestId as string;
        if (!sessionId || !requestId) throw new Error('sessionId and requestId required');
        const full = args.full === true;
        const result = browserInspector.networkGetResponse(sessionId, requestId, full);
        return wrap(JSON.stringify(result, null, 2));
      }
      case 'network_replay': {
        const sessionId = args.sessionId as string;
        const requestId = args.requestId as string;
        if (!sessionId || !requestId) throw new Error('sessionId and requestId required');
        const overrides = args.overrides as Record<string, unknown> | undefined;
        const result = await browserInspector.networkReplay(sessionId, requestId, overrides as Parameters<typeof browserInspector.networkReplay>[2]);
        return wrap(JSON.stringify(result, null, 2));
      }
      case 'network_clear': {
        const sessionId = args.sessionId as string;
        if (!sessionId) throw new Error('sessionId required');
        browserInspector.networkClear(sessionId);
        return wrap(JSON.stringify({ success: true }, null, 2));
      }
      case 'last_actions': {
        const sessionId = args.sessionId as string;
        const limit = (args.limit as number) || 10;
        if (!sessionId) throw new Error('sessionId required');
        const actions = browserInspector.getLastActions(sessionId, limit);
        return wrap(JSON.stringify(actions, null, 2));
      }
      default:
        return wrap(JSON.stringify({ error: `Unknown tool: ${name}` }));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return wrap(JSON.stringify({ error: message }));
  }
}
