/**
 * Validator Agent: tests DSL flows with multiple scenarios and reports issues.
 *
 * This agent has access ONLY to read + validate + run tools (no browser, no conversation, no flow modification).
 * It receives a flow description and test scenarios, runs them, and returns a structured report.
 */

import { VALIDATOR_AGENT_TOOLS } from '../agentTools.js';
import { runAgentLoop } from './runAgentLoop.js';
import type { ValidatorAgentOptions, ValidatorAgentResult } from './types.js';
import type { AgentMessage } from '../contextManager.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Validator Agent System Prompt (embedded constant — not user-customizable)
// ═══════════════════════════════════════════════════════════════════════════════

const VALIDATOR_AGENT_SYSTEM_PROMPT = `# Validator Agent — Multi-Scenario Flow Tester

You are a specialized agent that tests ShowRun DSL flows with multiple input scenarios. You have access ONLY to read, validate, and run tools — you CANNOT modify the flow or browse the web.

## Your Role

You receive:
1. **Flow description**: What the flow does and what data it extracts
2. **Test scenarios**: Input sets to test with (you may also generate additional edge cases)
3. **Exploration context** (optional): Extra information about the target site and expected data

Your job is to:
1. Call \`editor_read_pack\` to understand the flow structure, inputs, and collectibles
2. Call \`editor_validate_flow\` to check structural validity
3. Run each test scenario via \`editor_run_pack\` and analyze results
4. Generate additional edge-case scenarios if fewer than 3 were provided
5. Compile a structured validation report

## YOU CANNOT MODIFY THE FLOW

You are a **tester**, not a builder. You can only:
- \`editor_read_pack\` — read the flow
- \`editor_validate_flow\` — check structural validity
- \`editor_run_pack\` — run the flow with inputs

If the flow has issues, document them in your report. Do NOT attempt to fix them.

## Validation Steps

### Step 1: Read & Understand
Call \`editor_read_pack\` to see the flow structure. Note:
- What inputs are defined (names, types, required/optional)
- What collectibles are expected (names, types)
- How many steps are in the flow
- Whether network steps or DOM steps are used

### Step 2: Structural Validation
Call \`editor_validate_flow\` with the flow JSON to check for structural errors (missing fields, invalid step types, etc.).

### Step 3: Run Provided Scenarios
For each test scenario provided, call \`editor_run_pack\` with the scenario's inputs and analyze:
- Did the run succeed (\`success: true\`)?
- Are collectibles non-empty?
- Does the data look correct based on expected behavior?
- Are there any errors or warnings?

### Step 4: Generate Edge Cases
If fewer than 3 test scenarios were provided, generate additional ones:
- **Empty string input**: Test with empty strings for required fields
- **Special characters**: Test with special characters (quotes, ampersands, unicode)
- **Boundary values**: Test with very long strings, numbers at limits
- **Missing optional inputs**: Test with only required inputs provided

Run each generated scenario with \`editor_run_pack\`.

### Step 5: Compile Report
After all scenarios have been run, provide your final assessment as a structured summary:
- Overall pass/fail status
- Per-scenario results (name, inputs, passed/failed, actual behavior, errors)
- Structural validation results
- Recommendations for improvement

## Important Rules

1. **Run ALL scenarios** — don't skip scenarios even if early ones fail
2. **Be objective** — report exactly what happened, don't guess
3. **Check data quality** — empty collectibles or incorrect data count as failures
4. **Note patterns** — if all scenarios fail the same way, that's important context
5. **Don't retry failed runs** — if a scenario fails, document the failure and move on
6. **Keep it concise** — your report should be actionable, not verbose
`;

const MAX_VALIDATOR_ITERATIONS = 15;

/** Allowed tool names for the Validator Agent */
const VALIDATOR_ALLOWED_TOOLS = new Set([
  'editor_read_pack',
  'editor_validate_flow',
  'editor_run_pack',
]);

/**
 * Run the Validator Agent to test a DSL flow with multiple scenarios.
 */
export async function runValidatorAgent(options: ValidatorAgentOptions): Promise<ValidatorAgentResult> {
  const {
    flowDescription,
    testScenarios,
    explorationContext,
    llmProvider,
    toolExecutor,
    onStreamEvent,
    onToolError,
    abortSignal,
    sessionKey,
  } = options;

  // Build the initial user message with all context
  const parts: string[] = [
    '## Flow Description\n',
    flowDescription,
  ];

  if (testScenarios && testScenarios.length > 0) {
    parts.push('\n\n## Test Scenarios\n');
    parts.push('Run each of these scenarios with `editor_run_pack`:\n');
    parts.push('```json\n' + JSON.stringify(testScenarios, null, 2) + '\n```');
  } else {
    parts.push('\n\n## Test Scenarios\n');
    parts.push('No specific scenarios provided. Read the pack inputs, then generate at least 3 test scenarios (normal case, edge case, boundary case) and run each.');
  }

  if (explorationContext) {
    parts.push('\n\n## Exploration Context\n');
    parts.push(explorationContext);
  }

  parts.push('\n\nStart by reading the pack with `editor_read_pack`, then validate and run test scenarios.');

  const userMessage = parts.join('');

  const initialMessages: AgentMessage[] = [
    { role: 'user', content: userMessage },
  ];

  // Track scenario results
  let structuralValidation: ValidatorAgentResult['structuralValidation'] | undefined;
  const scenarioResults: ValidatorAgentResult['scenarioResults'] = [];
  let runCount = 0;

  // Wrap onStreamEvent to tag with agent: 'validator'
  const taggedEmit = (event: Record<string, unknown>) => {
    onStreamEvent?.({ ...event, agent: 'validator' });
  };

  // Wrap the tool executor to enforce allowed tools and track results
  const trackingToolExecutor = async (name: string, args: Record<string, unknown>) => {
    // Only allow validator tools
    if (!VALIDATOR_ALLOWED_TOOLS.has(name)) {
      return {
        stringForLlm: JSON.stringify({ error: `Tool "${name}" is not available to the Validator Agent. Only editor_read_pack, editor_validate_flow, and editor_run_pack are allowed.` }),
      };
    }

    const result = await toolExecutor(name, args);

    // Track validate_flow results
    if (name === 'editor_validate_flow') {
      try {
        const parsed = JSON.parse(result.stringForLlm);
        structuralValidation = {
          ok: !!parsed.ok,
          errors: parsed.errors || [],
          warnings: parsed.warnings || [],
        };
      } catch {
        // ignore parse errors
      }
    }

    // Track run_pack results
    if (name === 'editor_run_pack') {
      runCount++;
      try {
        const parsed = JSON.parse(result.stringForLlm);
        const inputs = (args.inputs as Record<string, unknown>) || {};

        if (parsed._truncated && typeof parsed.partialOutput === 'string') {
          // Truncated output — extract key fields via regex
          const successMatch = parsed.partialOutput.match(/"success"\s*:\s*(true|false)/);
          const errorMatch = parsed.partialOutput.match(/"error"\s*:\s*"([^"]{0,200})"/);
          scenarioResults.push({
            name: `Scenario ${runCount}`,
            inputs,
            passed: successMatch ? successMatch[1] === 'true' : false,
            actualBehavior: successMatch ? (successMatch[1] === 'true' ? 'Succeeded (truncated output)' : 'Failed') : 'Unknown (truncated)',
            collectiblesPreview: '(truncated)',
            error: errorMatch?.[1],
          });
        } else {
          const collectiblesPreview = JSON.stringify(parsed.collectibles ?? {}).slice(0, 500);
          const hasData = collectiblesPreview.length > 4; // more than "{}" or "[]"
          scenarioResults.push({
            name: `Scenario ${runCount}`,
            inputs,
            passed: !!parsed.success && hasData,
            actualBehavior: parsed.success
              ? (hasData ? `Succeeded with data` : 'Succeeded but collectibles empty')
              : `Failed: ${parsed.error || 'unknown error'}`,
            collectiblesPreview,
            error: parsed.error,
          });
        }
      } catch {
        // ignore parse errors
      }
    }

    return result;
  };

  const loopResult = await runAgentLoop({
    systemPrompt: VALIDATOR_AGENT_SYSTEM_PROMPT,
    tools: VALIDATOR_AGENT_TOOLS,
    initialMessages,
    llmProvider,
    toolExecutor: trackingToolExecutor,
    maxIterations: MAX_VALIDATOR_ITERATIONS,
    onStreamEvent: taggedEmit,
    onToolError,
    abortSignal,
    sessionKey,
    enableStreaming: !!onStreamEvent,
  });

  // Build result
  const scenariosPassed = scenarioResults.filter(s => s.passed).length;
  const scenariosFailed = scenarioResults.filter(s => !s.passed).length;
  const allPassed = scenarioResults.length > 0 && scenariosFailed === 0;
  const structuralOk = structuralValidation?.ok !== false;

  // Extract recommendations from the agent's final content
  const recommendations: string[] = [];
  if (!structuralOk && structuralValidation) {
    for (const err of structuralValidation.errors) {
      recommendations.push(`Fix structural error: ${err}`);
    }
  }
  if (scenariosFailed > 0) {
    recommendations.push(`${scenariosFailed} of ${scenarioResults.length} scenario(s) failed — review the scenario results for details.`);
  }
  if (scenarioResults.length === 0) {
    recommendations.push('No scenarios were run — check if the flow has inputs defined and the pack is properly configured.');
  }

  return {
    success: allPassed && structuralOk && !loopResult.aborted,
    summary: loopResult.finalContent || `Validator completed. ${scenariosPassed}/${scenarioResults.length} scenarios passed.`,
    scenariosRun: scenarioResults.length,
    scenariosPassed,
    scenariosFailed,
    scenarioResults,
    structuralValidation,
    recommendations,
    error: loopResult.aborted ? 'Aborted by user' : undefined,
    iterationsUsed: loopResult.iterationsUsed,
  };
}
