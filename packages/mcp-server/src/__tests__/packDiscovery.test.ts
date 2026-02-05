import { describe, it, expect } from 'vitest';
import { packIdToToolName } from '../packDiscovery.js';

describe('packIdToToolName', () => {
  it('replaces dots with underscores', () => {
    expect(packIdToToolName('example.site.collector')).toBe('example.site.collector');
  });

  it('preserves valid characters', () => {
    expect(packIdToToolName('my-pack_v1')).toBe('my-pack_v1');
  });

  it('preserves alphanumeric characters', () => {
    expect(packIdToToolName('pack123ABC')).toBe('pack123ABC');
  });

  it('replaces @ with underscore', () => {
    expect(packIdToToolName('pack@v1')).toBe('pack_v1');
  });

  it('replaces special characters', () => {
    expect(packIdToToolName('pack@v1!test')).toBe('pack_v1_test');
  });

  it('replaces multiple special characters', () => {
    expect(packIdToToolName('a@b#c$d%e')).toBe('a_b_c_d_e');
  });

  it('handles empty string', () => {
    expect(packIdToToolName('')).toBe('');
  });

  it('handles string with only special characters', () => {
    expect(packIdToToolName('!@#$%')).toBe('_____');
  });

  it('handles spaces', () => {
    expect(packIdToToolName('my pack name')).toBe('my_pack_name');
  });

  it('preserves hyphens', () => {
    expect(packIdToToolName('my-task-pack')).toBe('my-task-pack');
  });

  it('preserves underscores', () => {
    expect(packIdToToolName('my_task_pack')).toBe('my_task_pack');
  });

  it('preserves dots', () => {
    expect(packIdToToolName('com.example.pack')).toBe('com.example.pack');
  });

  it('handles mixed valid and invalid characters', () => {
    expect(packIdToToolName('my-pack.v1@beta!test')).toBe('my-pack.v1_beta_test');
  });
});
