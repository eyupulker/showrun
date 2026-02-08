import type { TaskPack, CollectibleDefinition } from './types.js';
import type { DslStep } from './dsl/types.js';
import { validateFlow, ValidationError } from './dsl/validation.js';

/**
 * Validates that collectibles referenced in flow steps exist
 */
export function validateCollectiblesMatchFlow(
  collectibles: CollectibleDefinition[],
  flow: DslStep[]
): void {
  const collectibleNames = new Set(collectibles.map((c) => c.name));
  const referencedOuts = new Set<string>();

  // Extract all 'out' parameters from extraction steps
  for (const step of flow) {
    if (step.type === 'extract_title' || step.type === 'extract_text' || step.type === 'extract_attribute') {
      const out = (step.params as { out?: string })?.out;
      if (out && typeof out === 'string') {
        referencedOuts.add(out);
      }
    }
  }

  // Check that all referenced outs exist in collectibles
  for (const out of referencedOuts) {
    if (!collectibleNames.has(out)) {
      throw new ValidationError(
        `Flow references collectible "${out}" in extraction step, but it's not defined in collectibles schema`
      );
    }
  }
}

/**
 * Validates a JSON Task Pack structure
 */
export function validateJsonTaskPack(pack: TaskPack): void {
  const errors: string[] = [];

  // Validate metadata
  if (!pack.metadata.id || !pack.metadata.name || !pack.metadata.version) {
    errors.push('Task pack must have metadata.id, metadata.name, and metadata.version');
  }

  // Validate inputs schema
  if (!pack.inputs || typeof pack.inputs !== 'object') {
    errors.push('Task pack must have an inputs object');
  }

  // Validate collectibles
  if (!Array.isArray(pack.collectibles)) {
    errors.push('Task pack must have a collectibles array');
  }

  // Validate flow
  if (!pack.flow || !Array.isArray(pack.flow)) {
    errors.push('Task pack must have a flow array');
  } else {
    // Validate flow (includes step validation and duplicate ID check)
    validateFlow(pack.flow, errors);

    // Validate collectibles match flow
    if (pack.collectibles && pack.flow) {
      try {
        validateCollectiblesMatchFlow(pack.collectibles, pack.flow);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
  }

  if (errors.length > 0) {
    throw new ValidationError(`Task pack validation failed:\n${errors.join('\n')}`);
  }
}
