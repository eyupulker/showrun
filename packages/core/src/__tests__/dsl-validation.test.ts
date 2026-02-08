import { describe, it, expect } from 'vitest';
import { validateFlow, ValidationError } from '../dsl/validation.js';

describe('validateFlow — collect-all errors', () => {
  it('collects multiple errors from a single step', () => {
    const errors: string[] = [];
    // Step with no id, no type, no params
    validateFlow([{}], errors);

    expect(errors.length).toBeGreaterThanOrEqual(3);
    expect(errors.some((e) => e.includes('must have a non-empty string "id"'))).toBe(true);
    expect(errors.some((e) => e.includes('must have a non-empty string "type"'))).toBe(true);
    expect(errors.some((e) => e.includes('must have a "params" object'))).toBe(true);
  });

  it('collects errors from multiple bad steps', () => {
    const errors: string[] = [];
    validateFlow(
      [
        { id: 'nav_1', type: 'navigate', params: {} }, // missing url
        { id: 'click_1', type: 'click', params: { first: 'yes' } }, // missing target + bad first
      ],
      errors
    );

    expect(errors.length).toBeGreaterThanOrEqual(3);
    // Errors from step 0
    expect(errors.some((e) => e.includes('Step 0') && e.includes('Navigate'))).toBe(true);
    // Errors from step 1
    expect(errors.some((e) => e.includes('Step 1') && e.includes('Click step must have either'))).toBe(true);
    expect(errors.some((e) => e.includes('Step 1') && e.includes('"first" must be a boolean'))).toBe(true);
  });

  it('reports nested target errors alongside param errors', () => {
    const errors: string[] = [];
    validateFlow(
      [
        {
          id: 'click_bad',
          type: 'click',
          params: {
            target: { kind: 'role', role: 'INVALID' }, // bad role
            first: 'not-bool', // bad type
          },
        },
      ],
      errors
    );

    expect(errors.length).toBeGreaterThanOrEqual(2);
    expect(errors.some((e) => e.includes('Role target must have a valid role'))).toBe(true);
    expect(errors.some((e) => e.includes('"first" must be a boolean'))).toBe(true);
  });

  it('reports duplicate ID alongside field-level errors', () => {
    const errors: string[] = [];
    validateFlow(
      [
        { id: 'dup', type: 'navigate', params: { url: 'https://example.com' } },
        { id: 'dup', type: 'click', params: {} }, // duplicate ID + missing target
      ],
      errors
    );

    expect(errors.some((e) => e.includes('Duplicate step ID'))).toBe(true);
    expect(errors.some((e) => e.includes('Click step must have either'))).toBe(true);
  });

  it('backwards compat: throws on first error when collectedErrors is omitted', () => {
    expect(() =>
      validateFlow([
        { id: 'nav_1', type: 'navigate', params: {} }, // missing url
        { id: 'click_1', type: 'click', params: {} }, // missing target
      ])
    ).toThrow(ValidationError);

    // Should throw only one error (the first)
    try {
      validateFlow([
        { id: 'nav_1', type: 'navigate', params: {} },
        { id: 'click_1', type: 'click', params: {} },
      ]);
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      // Message should reference step 0 only
      expect((e as Error).message).toContain('Step 0');
    }
  });

  it('collects no errors for a valid flow', () => {
    const errors: string[] = [];
    validateFlow(
      [
        { id: 'nav_1', type: 'navigate', params: { url: 'https://example.com' } },
        { id: 'click_1', type: 'click', params: { selector: '#btn' } },
      ],
      errors
    );

    expect(errors).toEqual([]);
  });

  it('error prefix includes step index, id, and type', () => {
    const errors: string[] = [];
    validateFlow(
      [{ id: 'my_step', type: 'navigate', params: {} }],
      errors
    );

    expect(errors.length).toBe(1);
    expect(errors[0]).toMatch(/^Step 0 \(id="my_step", type="navigate"\):/);
  });

  it('uses "?" for unknown id and type', () => {
    const errors: string[] = [];
    validateFlow([{ params: { url: 'https://example.com' } }], errors);

    expect(errors.some((e) => e.includes('id="?"'))).toBe(true);
    expect(errors.some((e) => e.includes('type="?"'))).toBe(true);
  });

  it('handles non-array input with collectedErrors', () => {
    const errors: string[] = [];
    validateFlow('not-an-array' as unknown as unknown[], errors);

    expect(errors).toEqual(['Flow must be an array of steps']);
  });

  it('handles non-array input without collectedErrors (throws)', () => {
    expect(() => validateFlow('not-an-array' as unknown as unknown[])).toThrow(
      'Flow must be an array of steps'
    );
  });

  it('handles step that is not an object', () => {
    const errors: string[] = [];
    validateFlow([null, 'string-step', 42], errors);

    expect(errors.length).toBe(3);
    expect(errors[0]).toContain('Step 0');
    expect(errors[1]).toContain('Step 1');
    expect(errors[2]).toContain('Step 2');
  });
});
