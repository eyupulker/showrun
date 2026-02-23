/**
 * Tests for the three-agent architecture: Validator Agent tool definitions.
 */

import { describe, it, expect } from 'vitest';
import {
  EXPLORATION_AGENT_TOOLS,
  VALIDATOR_AGENT_TOOLS,
  MCP_AGENT_TOOL_DEFINITIONS,
} from '../../agentTools.js';

describe('Validator Agent Tool Definitions', () => {
  it('VALIDATOR_AGENT_TOOLS contains exactly 3 tools (read, validate, run)', () => {
    const names = VALIDATOR_AGENT_TOOLS.map(t => t.function.name);
    expect(names).toHaveLength(3);
    expect(names).toContain('editor_read_pack');
    expect(names).toContain('editor_validate_flow');
    expect(names).toContain('editor_run_pack');
  });

  it('VALIDATOR_AGENT_TOOLS does NOT contain patch or browser tools', () => {
    const names = VALIDATOR_AGENT_TOOLS.map(t => t.function.name);
    expect(names).not.toContain('editor_apply_flow_patch');
    expect(names).not.toContain('editor_create_pack');
    expect(names).not.toContain('editor_list_secrets');
    expect(names).not.toContain('browser_goto');
    expect(names).not.toContain('browser_screenshot');
    expect(names).not.toContain('browser_click');
    expect(names).not.toContain('conversation_set_status');
    expect(names).not.toContain('agent_save_plan');
    expect(names).not.toContain('agent_build_flow');
    expect(names).not.toContain('agent_validate_flow');
  });

  it('EXPLORATION_AGENT_TOOLS contains agent_validate_flow', () => {
    const names = EXPLORATION_AGENT_TOOLS.map(t => t.function.name);
    expect(names).toContain('agent_validate_flow');
  });

  it('agent_validate_flow has correct parameter schema', () => {
    const validateFlowTool = EXPLORATION_AGENT_TOOLS.find(t => t.function.name === 'agent_validate_flow');
    expect(validateFlowTool).toBeDefined();
    const params = validateFlowTool!.function.parameters;
    expect(params.properties).toHaveProperty('flowDescription');
    expect(params.properties).toHaveProperty('testScenarios');
    expect(params.properties).toHaveProperty('explorationContext');
    expect(params.required).toContain('flowDescription');
    expect(params.required).not.toContain('testScenarios');
    expect(params.required).not.toContain('explorationContext');
  });

  it('agent_validate_flow testScenarios items have correct schema', () => {
    const validateFlowTool = EXPLORATION_AGENT_TOOLS.find(t => t.function.name === 'agent_validate_flow');
    expect(validateFlowTool).toBeDefined();
    const props = validateFlowTool!.function.parameters.properties as Record<string, any>;
    const scenariosSchema = props.testScenarios;
    expect(scenariosSchema).toBeDefined();
    expect(scenariosSchema.type).toBe('array');
    expect(scenariosSchema.items).toBeDefined();
    expect(scenariosSchema.items.properties).toHaveProperty('name');
    expect(scenariosSchema.items.properties).toHaveProperty('inputs');
    expect(scenariosSchema.items.properties).toHaveProperty('expectedBehavior');
    expect(scenariosSchema.items.required).toContain('name');
    expect(scenariosSchema.items.required).toContain('inputs');
    expect(scenariosSchema.items.required).not.toContain('expectedBehavior');
  });

  it('all VALIDATOR_AGENT_TOOLS come from MCP_AGENT_TOOL_DEFINITIONS', () => {
    const masterNames = new Set(MCP_AGENT_TOOL_DEFINITIONS.map(t => t.function.name));
    for (const tool of VALIDATOR_AGENT_TOOLS) {
      expect(masterNames.has(tool.function.name)).toBe(true);
    }
  });

  it('EXPLORATION_AGENT_TOOLS still contains agent_build_flow', () => {
    const names = EXPLORATION_AGENT_TOOLS.map(t => t.function.name);
    expect(names).toContain('agent_build_flow');
  });
});
