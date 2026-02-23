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

describe('validateFlow — unknown params rejection', () => {
  it('rejects unknown params like "extract" and "expression" on extract_text', () => {
    const errors: string[] = [];
    validateFlow(
      [
        {
          id: 'bad_extract',
          type: 'extract_text',
          params: {
            selector: '.price',
            out: 'price',
            extract: 'eval',
            expression: 'parseFloat(text)',
          },
        },
      ],
      errors
    );

    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('Unknown param(s) "extract", "expression"');
    expect(errors[0]).toContain('"extract_text" step');
    expect(errors[0]).toContain('Allowed params:');
  });

  it('provides eval hint when unknown param name looks eval-like', () => {
    const errors: string[] = [];
    validateFlow(
      [
        {
          id: 'eval_step',
          type: 'extract_text',
          params: {
            selector: '.data',
            out: 'result',
            eval: 'some expression',
          },
        },
      ],
      errors
    );

    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('network_extract step with a JMESPath');
  });

  it('does not provide eval hint for non-eval-like unknown params', () => {
    const errors: string[] = [];
    validateFlow(
      [
        {
          id: 'typo_step',
          type: 'click',
          params: {
            selector: '#btn',
            frist: true, // typo of "first"
          },
        },
      ],
      errors
    );

    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('Unknown param(s) "frist"');
    expect(errors[0]).not.toContain('network_extract');
  });

  it('detects eval() in string param values', () => {
    const errors: string[] = [];
    validateFlow(
      [
        {
          id: 'eval_value',
          type: 'fill',
          params: {
            selector: '#input',
            value: 'eval(document.cookie)',
          },
        },
      ],
      errors
    );

    expect(errors.some((e) => e.includes('contains eval()'))).toBe(true);
    expect(errors.some((e) => e.includes('network_extract'))).toBe(true);
  });

  it('allows valid params without errors', () => {
    const errors: string[] = [];
    validateFlow(
      [
        {
          id: 'valid_extract',
          type: 'extract_text',
          params: {
            selector: '.price',
            out: 'price',
            first: true,
            trim: true,
            default: 'N/A',
          },
        },
      ],
      errors
    );

    expect(errors).toEqual([]);
  });

  it('does not reject unknown params for unknown step types', () => {
    const errors: string[] = [];
    validateFlow(
      [
        {
          id: 'custom_step',
          type: 'custom_magic',
          params: { anything: 'goes' },
        },
      ],
      errors
    );

    // Should only have the "Unknown step type" error, not unknown params
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain('Unknown step type: custom_magic');
  });
});

describe('validateFlow — dom_scrape step', () => {
  const validDomScrape = {
    id: 'scrape_results',
    type: 'dom_scrape',
    params: {
      target: { kind: 'css', selector: '.search-result' },
      collect: [
        { key: 'title', target: { kind: 'css', selector: 'h3' } },
        { key: 'url', target: { kind: 'css', selector: 'a' }, extract: 'attribute', attribute: 'href' },
        { key: 'description', target: { kind: 'css', selector: '.snippet' } },
      ],
      skip_empty: true,
      out: 'results',
    },
  };

  it('accepts a valid dom_scrape step', () => {
    const errors: string[] = [];
    validateFlow([validDomScrape], errors);
    expect(errors).toEqual([]);
  });

  it('accepts dom_scrape with legacy selector', () => {
    const errors: string[] = [];
    validateFlow([{
      id: 'scrape_legacy',
      type: 'dom_scrape',
      params: {
        selector: '.item',
        collect: [{ key: 'name', target: { kind: 'css', selector: 'span' } }],
        out: 'items',
      },
    }], errors);
    expect(errors).toEqual([]);
  });

  it('errors when missing target and selector', () => {
    const errors: string[] = [];
    validateFlow([{
      id: 'scrape_no_target',
      type: 'dom_scrape',
      params: {
        collect: [{ key: 'name', target: { kind: 'css', selector: 'span' } }],
        out: 'items',
      },
    }], errors);
    expect(errors.some(e => e.includes('must have either "selector" or "target"'))).toBe(true);
  });

  it('errors when missing out', () => {
    const errors: string[] = [];
    validateFlow([{
      id: 'scrape_no_out',
      type: 'dom_scrape',
      params: {
        target: { kind: 'css', selector: '.item' },
        collect: [{ key: 'name', target: { kind: 'css', selector: 'span' } }],
      },
    }], errors);
    expect(errors.some(e => e.includes('non-empty string "out"'))).toBe(true);
  });

  it('errors when collect is empty', () => {
    const errors: string[] = [];
    validateFlow([{
      id: 'scrape_empty_collect',
      type: 'dom_scrape',
      params: {
        target: { kind: 'css', selector: '.item' },
        collect: [],
        out: 'items',
      },
    }], errors);
    expect(errors.some(e => e.includes('non-empty "collect" array'))).toBe(true);
  });

  it('errors when collect is missing', () => {
    const errors: string[] = [];
    validateFlow([{
      id: 'scrape_missing_collect',
      type: 'dom_scrape',
      params: {
        target: { kind: 'css', selector: '.item' },
        out: 'items',
      },
    }], errors);
    expect(errors.some(e => e.includes('non-empty "collect" array'))).toBe(true);
  });

  it('errors on duplicate collect keys', () => {
    const errors: string[] = [];
    validateFlow([{
      id: 'scrape_dup_keys',
      type: 'dom_scrape',
      params: {
        target: { kind: 'css', selector: '.item' },
        collect: [
          { key: 'name', target: { kind: 'css', selector: 'h3' } },
          { key: 'name', target: { kind: 'css', selector: 'h4' } },
        ],
        out: 'items',
      },
    }], errors);
    expect(errors.some(e => e.includes('duplicate key "name"'))).toBe(true);
  });

  it('errors when collect field missing key', () => {
    const errors: string[] = [];
    validateFlow([{
      id: 'scrape_no_key',
      type: 'dom_scrape',
      params: {
        target: { kind: 'css', selector: '.item' },
        collect: [{ target: { kind: 'css', selector: 'span' } }],
        out: 'items',
      },
    }], errors);
    expect(errors.some(e => e.includes('collect[0] must have a non-empty string "key"'))).toBe(true);
  });

  it('errors when collect field missing target', () => {
    const errors: string[] = [];
    validateFlow([{
      id: 'scrape_no_field_target',
      type: 'dom_scrape',
      params: {
        target: { kind: 'css', selector: '.item' },
        collect: [{ key: 'name' }],
        out: 'items',
      },
    }], errors);
    expect(errors.some(e => e.includes('collect[0] must have a "target"'))).toBe(true);
  });

  it('errors when extract is "attribute" but attribute is missing', () => {
    const errors: string[] = [];
    validateFlow([{
      id: 'scrape_attr_missing',
      type: 'dom_scrape',
      params: {
        target: { kind: 'css', selector: '.item' },
        collect: [
          { key: 'url', target: { kind: 'css', selector: 'a' }, extract: 'attribute' },
        ],
        out: 'items',
      },
    }], errors);
    expect(errors.some(e => e.includes('requires "attribute" when extract is "attribute"'))).toBe(true);
  });

  it('errors on invalid extract value', () => {
    const errors: string[] = [];
    validateFlow([{
      id: 'scrape_bad_extract',
      type: 'dom_scrape',
      params: {
        target: { kind: 'css', selector: '.item' },
        collect: [
          { key: 'val', target: { kind: 'css', selector: 'span' }, extract: 'innerText' },
        ],
        out: 'items',
      },
    }], errors);
    expect(errors.some(e => e.includes('"extract" must be "text", "attribute", or "html"'))).toBe(true);
  });

  it('errors on unknown fields in collect entry', () => {
    const errors: string[] = [];
    validateFlow([{
      id: 'scrape_unknown_field',
      type: 'dom_scrape',
      params: {
        target: { kind: 'css', selector: '.item' },
        collect: [
          { key: 'name', target: { kind: 'css', selector: 'span' }, trim: true },
        ],
        out: 'items',
      },
    }], errors);
    expect(errors.some(e => e.includes('unknown field(s): "trim"'))).toBe(true);
  });

  it('accepts dom_scrape with html extract', () => {
    const errors: string[] = [];
    validateFlow([{
      id: 'scrape_html',
      type: 'dom_scrape',
      params: {
        target: { kind: 'css', selector: '.item' },
        collect: [
          { key: 'content', target: { kind: 'css', selector: '.body' }, extract: 'html' },
        ],
        out: 'items',
      },
    }], errors);
    expect(errors).toEqual([]);
  });
});
