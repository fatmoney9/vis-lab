import test from 'node:test';
import assert from 'node:assert/strict';

import { createTextMeasurer, measureInk, measureTexts } from '../charts/core/measure.js';

class FakeNode {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.parentNode = null;
    this.style = {};
    this.textContent = '';
    this.attributes = {};
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
  }

  getComputedTextLength() {
    const fontSize = Number.parseFloat(this.style.fontSize) || 10;
    const factor = this.getAttribute('class')?.includes('wide') ? 2 : 1;
    return Array.from(this.textContent).length * fontSize * factor;
  }
}

function withFakeDocument(run) {
  const original = globalThis.document;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  globalThis.document = {
    createElementNS: (_namespace, tagName) => new FakeNode(tagName),
    createElement: (tagName) => {
      assert.equal(tagName, 'canvas');
      const context = {
        font: '',
        measureText: () => ({
          actualBoundingBoxAscent: context.font.includes('700') ? 9 : 7,
          actualBoundingBoxDescent: context.font.includes('700') ? 3 : 2,
          hangingBaseline: 8,
        }),
      };
      return { getContext: () => context };
    },
  };
  globalThis.getComputedStyle = (node) => ({
    fontStyle: 'normal',
    fontWeight: node.getAttribute('class')?.includes('bold') ? '700' : '400',
    fontSize: '12px',
    fontFamily: 'sans-serif',
  });
  try {
    return run();
  } finally {
    globalThis.document = original;
    globalThis.getComputedStyle = originalGetComputedStyle;
    measureInk.ctx = null;
  }
}

test('TREEMAP-05：可复用测量器按传入字号测量并在销毁时清理', () => {
  withFakeDocument(() => {
    const host = new FakeNode('host');
    const measurer = createTextMeasurer(host, 'dv-treemap-label__value');
    assert.equal(host.children.length, 1);
    assert.equal(measurer.measure('1234', 14), 56);
    assert.equal(measurer.measure('1234', 11), 44);
    measurer.destroy();
    assert.equal(host.children.length, 0);
  });
});

test('AXIS-08：批量宽度测量允许逐项应用真实渲染类', () => {
  withFakeDocument(() => {
    const host = new FakeNode('host');
    const widths = measureTexts(host, ['A', 'A'], (_text, index) => (
      index === 1 ? 'dv-axis-label wide' : 'dv-axis-label'
    ));
    assert.deepEqual(widths, [10, 20]);
    assert.equal(host.children.length, 0);
  });
});

test('AXIS-08/TOOLTIP-09：墨迹测量按逐行类分别解析字体', () => {
  withFakeDocument(() => {
    const host = new FakeNode('host');
    const metrics = measureInk(host, ['Name', '100'], (_text, index) => (
      index === 1 ? 'dv-axis-label bold' : 'dv-axis-label'
    ));
    assert.deepEqual(metrics, [
      { ascent: 7, descent: 2, hanging: 8 },
      { ascent: 9, descent: 3, hanging: 8 },
    ]);
    assert.equal(host.children.length, 0);
  });
});
