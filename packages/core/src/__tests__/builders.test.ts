import { describe, it, expect } from 'vitest';
import {
  targetCss,
  targetText,
  targetRole,
  targetLabel,
  targetPlaceholder,
  targetAltText,
  targetTestId,
  targetAnyOf,
  conditions,
  navigate,
  extractTitle,
  extractText,
  sleep,
  waitFor,
  click,
  fill,
  extractAttribute,
  assert,
  setVar,
  selectOption,
  pressKey,
  uploadFile,
  frame,
  newTab,
  switchTab,
} from '../dsl/builders.js';

describe('DSL Builders', () => {
  describe('Target Builders', () => {
    it('targetCss should create a css target', () => {
      expect(targetCss('#id')).toEqual({ kind: 'css', selector: '#id' });
    });

    it('targetText should create a text target', () => {
      expect(targetText('hello')).toEqual({ kind: 'text', text: 'hello', exact: undefined });
      expect(targetText('hello', true)).toEqual({ kind: 'text', text: 'hello', exact: true });
    });

    it('targetRole should create a role target', () => {
      expect(targetRole('button', 'Submit')).toEqual({ kind: 'role', role: 'button', name: 'Submit', exact: undefined });
      expect(targetRole('link', 'Home', true)).toEqual({ kind: 'role', role: 'link', name: 'Home', exact: true });
    });

    it('targetLabel should create a label target', () => {
      expect(targetLabel('Username')).toEqual({ kind: 'label', text: 'Username', exact: undefined });
      expect(targetLabel('Username', true)).toEqual({ kind: 'label', text: 'Username', exact: true });
    });

    it('targetPlaceholder should create a placeholder target', () => {
      expect(targetPlaceholder('Enter name')).toEqual({ kind: 'placeholder', text: 'Enter name', exact: undefined });
      expect(targetPlaceholder('Enter name', true)).toEqual({ kind: 'placeholder', text: 'Enter name', exact: true });
    });

    it('targetAltText should create an altText target', () => {
      expect(targetAltText('Logo')).toEqual({ kind: 'altText', text: 'Logo', exact: undefined });
      expect(targetAltText('Logo', true)).toEqual({ kind: 'altText', text: 'Logo', exact: true });
    });

    it('targetTestId should create a testId target', () => {
      expect(targetTestId('submit-btn')).toEqual({ kind: 'testId', id: 'submit-btn' });
    });

    it('targetAnyOf should create an anyOf target', () => {
      const targets = [targetCss('#id1'), targetCss('#id2')];
      expect(targetAnyOf(...targets)).toEqual({ anyOf: targets });
    });
  });

  describe('Condition Builders', () => {
    it('conditions.urlIncludes should create a url_includes condition', () => {
      expect(conditions.urlIncludes('example.com')).toEqual({ url_includes: 'example.com' });
    });

    it('conditions.urlMatches should create a url_matches condition', () => {
      expect(conditions.urlMatches('^https://')).toEqual({ url_matches: '^https://' });
    });

    it('conditions.elementVisible should create an element_visible condition', () => {
      const target = targetCss('#id');
      expect(conditions.elementVisible(target)).toEqual({ element_visible: target });
    });

    it('conditions.elementExists should create an element_exists condition', () => {
      const target = targetCss('#id');
      expect(conditions.elementExists(target)).toEqual({ element_exists: target });
    });

    it('conditions.varEquals should create a var_equals condition', () => {
      expect(conditions.varEquals('count', 5)).toEqual({ var_equals: { name: 'count', value: 5 } });
    });

    it('conditions.varTruthy should create a var_truthy condition', () => {
      expect(conditions.varTruthy('flag')).toEqual({ var_truthy: 'flag' });
    });

    it('conditions.varFalsy should create a var_falsy condition', () => {
      expect(conditions.varFalsy('flag')).toEqual({ var_falsy: 'flag' });
    });

    it('conditions.all should create an all condition', () => {
      const conds = [conditions.urlIncludes('a'), conditions.urlIncludes('b')];
      expect(conditions.all(...conds)).toEqual({ all: conds });
    });

    it('conditions.any should create an any condition', () => {
      const conds = [conditions.urlIncludes('a'), conditions.urlIncludes('b')];
      expect(conditions.any(...conds)).toEqual({ any: conds });
    });
  });

  describe('Step Builders', () => {
    it('navigate should create a navigate step', () => {
      const step = navigate('nav-1', { url: 'https://example.com', label: 'Go to home' });
      expect(step).toEqual({
        id: 'nav-1',
        type: 'navigate',
        label: 'Go to home',
        timeoutMs: undefined,
        optional: undefined,
        onError: undefined,
        params: {
          url: 'https://example.com',
          waitUntil: 'networkidle',
        },
      });
    });

    it('extractTitle should create an extract_title step', () => {
      const step = extractTitle('title-1', { out: 'pageTitle' });
      expect(step).toEqual({
        id: 'title-1',
        type: 'extract_title',
        label: undefined,
        timeoutMs: undefined,
        optional: undefined,
        onError: undefined,
        params: {
          out: 'pageTitle',
        },
      });
    });

    it('extractText should create an extract_text step', () => {
      const step = extractText('text-1', { target: targetCss('.price'), out: 'price' });
      expect(step).toEqual({
        id: 'text-1',
        type: 'extract_text',
        label: undefined,
        timeoutMs: undefined,
        optional: undefined,
        onError: undefined,
        params: {
          selector: undefined,
          target: { kind: 'css', selector: '.price' },
          out: 'price',
          first: true,
          trim: true,
          default: undefined,
          hint: undefined,
          scope: undefined,
          near: undefined,
        },
      });
    });

    it('sleep should create a sleep step', () => {
      const step = sleep('sleep-1', { durationMs: 1000 });
      expect(step).toEqual({
        id: 'sleep-1',
        type: 'sleep',
        label: undefined,
        timeoutMs: undefined,
        optional: undefined,
        onError: undefined,
        params: {
          durationMs: 1000,
        },
      });
    });

    it('waitFor should create a wait_for step', () => {
      const step = waitFor('wait-1', { target: targetCss('.loader'), visible: false });
      expect(step).toEqual({
        id: 'wait-1',
        type: 'wait_for',
        label: undefined,
        timeoutMs: 30000,
        optional: undefined,
        onError: undefined,
        params: {
          selector: undefined,
          target: { kind: 'css', selector: '.loader' },
          visible: false,
          url: undefined,
          loadState: undefined,
          timeoutMs: 30000,
          hint: undefined,
          scope: undefined,
          near: undefined,
        },
      });
    });

    it('click should create a click step', () => {
      const step = click('click-1', { target: targetRole('button', 'Login') });
      expect(step).toEqual({
        id: 'click-1',
        type: 'click',
        label: undefined,
        timeoutMs: undefined,
        optional: undefined,
        onError: undefined,
        params: {
          selector: undefined,
          target: { kind: 'role', role: 'button', name: 'Login', exact: undefined },
          first: true,
          waitForVisible: true,
          hint: undefined,
          scope: undefined,
          near: undefined,
        },
      });
    });

    it('fill should create a fill step', () => {
      const step = fill('fill-1', { target: targetCss('#user'), value: 'jdoe' });
      expect(step).toEqual({
        id: 'fill-1',
        type: 'fill',
        label: undefined,
        timeoutMs: undefined,
        optional: undefined,
        onError: undefined,
        params: {
          selector: undefined,
          target: { kind: 'css', selector: '#user' },
          value: 'jdoe',
          first: true,
          clear: true,
          hint: undefined,
          scope: undefined,
          near: undefined,
        },
      });
    });

    it('extractAttribute should create an extract_attribute step', () => {
      const step = extractAttribute('attr-1', { target: targetCss('a'), attribute: 'href', out: 'link' });
      expect(step).toEqual({
        id: 'attr-1',
        type: 'extract_attribute',
        label: undefined,
        timeoutMs: undefined,
        optional: undefined,
        onError: undefined,
        params: {
          selector: undefined,
          target: { kind: 'css', selector: 'a' },
          attribute: 'href',
          out: 'link',
          first: true,
          default: undefined,
          hint: undefined,
          scope: undefined,
          near: undefined,
        },
      });
    });

    it('assert should create an assert step', () => {
      const step = assert('assert-1', { target: targetCss('.error'), visible: true, textIncludes: 'Invalid' });
      expect(step).toEqual({
        id: 'assert-1',
        type: 'assert',
        label: undefined,
        timeoutMs: undefined,
        optional: undefined,
        onError: undefined,
        params: {
          selector: undefined,
          target: { kind: 'css', selector: '.error' },
          visible: true,
          textIncludes: 'Invalid',
          urlIncludes: undefined,
          message: undefined,
          hint: undefined,
          scope: undefined,
          near: undefined,
        },
      });
    });

    it('setVar should create a set_var step', () => {
      const step = setVar('var-1', { name: 'isDone', value: true });
      expect(step).toEqual({
        id: 'var-1',
        type: 'set_var',
        label: undefined,
        timeoutMs: undefined,
        optional: undefined,
        onError: undefined,
        params: {
          name: 'isDone',
          value: true,
        },
      });
    });

    it('selectOption should create a select_option step', () => {
      const step = selectOption('select-1', { target: targetCss('select'), value: 'opt1' });
      expect(step).toEqual({
        id: 'select-1',
        type: 'select_option',
        label: undefined,
        timeoutMs: undefined,
        optional: undefined,
        onError: undefined,
        params: {
          selector: undefined,
          target: { kind: 'css', selector: 'select' },
          value: 'opt1',
          first: true,
          hint: undefined,
          scope: undefined,
          near: undefined,
        },
      });
    });

    it('pressKey should create a press_key step', () => {
      const step = pressKey('key-1', { key: 'Enter' });
      expect(step).toEqual({
        id: 'key-1',
        type: 'press_key',
        label: undefined,
        timeoutMs: undefined,
        optional: undefined,
        onError: undefined,
        params: {
          key: 'Enter',
          selector: undefined,
          target: undefined,
          times: 1,
          delayMs: 0,
          hint: undefined,
          scope: undefined,
          near: undefined,
        },
      });
    });

    it('uploadFile should create an upload_file step', () => {
      const step = uploadFile('upload-1', { target: targetCss('input[type="file"]'), files: 'test.txt' });
      expect(step).toEqual({
        id: 'upload-1',
        type: 'upload_file',
        label: undefined,
        timeoutMs: undefined,
        optional: undefined,
        onError: undefined,
        params: {
          selector: undefined,
          target: { kind: 'css', selector: 'input[type="file"]' },
          files: 'test.txt',
          first: true,
          hint: undefined,
          scope: undefined,
          near: undefined,
        },
      });
    });

    it('frame should create a frame step', () => {
      const step = frame('frame-1', { frame: 'myframe', action: 'enter' });
      expect(step).toEqual({
        id: 'frame-1',
        type: 'frame',
        label: undefined,
        timeoutMs: undefined,
        optional: undefined,
        onError: undefined,
        params: {
          frame: 'myframe',
          action: 'enter',
        },
      });
    });

    it('newTab should create a new_tab step', () => {
      const step = newTab('tab-1', { url: 'https://example.com' });
      expect(step).toEqual({
        id: 'tab-1',
        type: 'new_tab',
        label: undefined,
        timeoutMs: undefined,
        optional: undefined,
        onError: undefined,
        params: {
          url: 'https://example.com',
          saveTabIndexAs: undefined,
        },
      });
    });

    it('switchTab should create a switch_tab step', () => {
      const step = switchTab('tab-2', { tab: 'last' });
      expect(step).toEqual({
        id: 'tab-2',
        type: 'switch_tab',
        label: undefined,
        timeoutMs: undefined,
        optional: undefined,
        onError: undefined,
        params: {
          tab: 'last',
          closeCurrentTab: false,
        },
      });
    });
  });
});
