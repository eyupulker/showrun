import { describe, it, expect } from 'vitest';
import { InputValidator } from '../validator.js';
import type { InputSchema } from '../types.js';

describe('InputValidator', () => {
  describe('validate', () => {
    it('passes for valid inputs with all required fields', () => {
      const schema: InputSchema = { name: { type: 'string', required: true } };
      expect(() => InputValidator.validate({ name: 'John' }, schema)).not.toThrow();
    });

    it('passes for valid inputs with optional fields omitted', () => {
      const schema: InputSchema = {
        name: { type: 'string', required: true },
        age: { type: 'number', required: false },
      };
      expect(() => InputValidator.validate({ name: 'John' }, schema)).not.toThrow();
    });

    it('passes for valid inputs with optional fields provided', () => {
      const schema: InputSchema = {
        name: { type: 'string', required: true },
        age: { type: 'number', required: false },
      };
      expect(() => InputValidator.validate({ name: 'John', age: 30 }, schema)).not.toThrow();
    });

    it('fails for missing required fields', () => {
      const schema: InputSchema = { name: { type: 'string', required: true } };
      expect(() => InputValidator.validate({}, schema)).toThrow(/Missing required field: name/);
    });

    it('fails for multiple missing required fields', () => {
      const schema: InputSchema = {
        name: { type: 'string', required: true },
        email: { type: 'string', required: true },
      };
      expect(() => InputValidator.validate({}, schema)).toThrow(/Missing required field/);
    });

    it('fails for wrong type - string expected', () => {
      const schema: InputSchema = { name: { type: 'string', required: true } };
      expect(() => InputValidator.validate({ name: 123 }, schema)).toThrow(/must be a string/);
    });

    it('fails for wrong type - number expected', () => {
      const schema: InputSchema = { age: { type: 'number', required: true } };
      expect(() => InputValidator.validate({ age: 'thirty' }, schema)).toThrow(/must be a number/);
    });

    it('fails for wrong type - boolean expected', () => {
      const schema: InputSchema = { enabled: { type: 'boolean', required: true } };
      expect(() => InputValidator.validate({ enabled: 'true' }, schema)).toThrow(/must be a boolean/);
    });

    it('fails for unknown fields', () => {
      const schema: InputSchema = { name: { type: 'string', required: true } };
      expect(() => InputValidator.validate({ name: 'John', extra: 'field' }, schema)).toThrow(
        /Unknown field: extra/
      );
    });

    it('validates number type correctly', () => {
      const schema: InputSchema = { count: { type: 'number', required: true } };
      expect(() => InputValidator.validate({ count: 42 }, schema)).not.toThrow();
      expect(() => InputValidator.validate({ count: 3.14 }, schema)).not.toThrow();
    });

    it('validates boolean type correctly', () => {
      const schema: InputSchema = { active: { type: 'boolean', required: true } };
      expect(() => InputValidator.validate({ active: true }, schema)).not.toThrow();
      expect(() => InputValidator.validate({ active: false }, schema)).not.toThrow();
    });

    it('handles empty schema', () => {
      const schema: InputSchema = {};
      expect(() => InputValidator.validate({}, schema)).not.toThrow();
    });

    it('fails for empty inputs with unknown field on empty schema', () => {
      const schema: InputSchema = {};
      expect(() => InputValidator.validate({ foo: 'bar' }, schema)).toThrow(/Unknown field: foo/);
    });
  });

  describe('applyDefaults', () => {
    it('applies defaults for missing fields', () => {
      const schema: InputSchema = { count: { type: 'number', default: 10 } };
      expect(InputValidator.applyDefaults({}, schema)).toEqual({ count: 10 });
    });

    it('does not override provided values', () => {
      const schema: InputSchema = { count: { type: 'number', default: 10 } };
      expect(InputValidator.applyDefaults({ count: 5 }, schema)).toEqual({ count: 5 });
    });

    it('applies string defaults', () => {
      const schema: InputSchema = { name: { type: 'string', default: 'Anonymous' } };
      expect(InputValidator.applyDefaults({}, schema)).toEqual({ name: 'Anonymous' });
    });

    it('applies boolean defaults', () => {
      const schema: InputSchema = { enabled: { type: 'boolean', default: true } };
      expect(InputValidator.applyDefaults({}, schema)).toEqual({ enabled: true });
    });

    it('applies false boolean default', () => {
      const schema: InputSchema = { enabled: { type: 'boolean', default: false } };
      expect(InputValidator.applyDefaults({}, schema)).toEqual({ enabled: false });
    });

    it('does not apply default when value is explicitly false', () => {
      const schema: InputSchema = { enabled: { type: 'boolean', default: true } };
      expect(InputValidator.applyDefaults({ enabled: false }, schema)).toEqual({ enabled: false });
    });

    it('does not apply default when value is explicitly 0', () => {
      const schema: InputSchema = { count: { type: 'number', default: 10 } };
      expect(InputValidator.applyDefaults({ count: 0 }, schema)).toEqual({ count: 0 });
    });

    it('does not apply default when value is explicitly empty string', () => {
      const schema: InputSchema = { name: { type: 'string', default: 'default' } };
      expect(InputValidator.applyDefaults({ name: '' }, schema)).toEqual({ name: '' });
    });

    it('applies multiple defaults', () => {
      const schema: InputSchema = {
        name: { type: 'string', default: 'User' },
        count: { type: 'number', default: 1 },
        active: { type: 'boolean', default: true },
      };
      expect(InputValidator.applyDefaults({}, schema)).toEqual({
        name: 'User',
        count: 1,
        active: true,
      });
    });

    it('applies only missing defaults', () => {
      const schema: InputSchema = {
        name: { type: 'string', default: 'User' },
        count: { type: 'number', default: 1 },
        active: { type: 'boolean', default: true },
      };
      expect(InputValidator.applyDefaults({ name: 'Custom' }, schema)).toEqual({
        name: 'Custom',
        count: 1,
        active: true,
      });
    });

    it('does not add fields without defaults', () => {
      const schema: InputSchema = {
        name: { type: 'string', required: true },
        count: { type: 'number', default: 10 },
      };
      expect(InputValidator.applyDefaults({}, schema)).toEqual({ count: 10 });
    });

    it('preserves existing fields not in schema', () => {
      const schema: InputSchema = { count: { type: 'number', default: 10 } };
      expect(InputValidator.applyDefaults({ extra: 'value' }, schema)).toEqual({
        extra: 'value',
        count: 10,
      });
    });

    it('returns new object without modifying input', () => {
      const schema: InputSchema = { count: { type: 'number', default: 10 } };
      const original = { name: 'test' };
      const result = InputValidator.applyDefaults(original, schema);

      expect(result).not.toBe(original);
      expect(original).toEqual({ name: 'test' });
      expect(result).toEqual({ name: 'test', count: 10 });
    });
  });
});
