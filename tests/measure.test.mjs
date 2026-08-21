import test from 'node:test';
import assert from 'node:assert/strict';

import { createTextMeasurer } from '../charts/core/measure.js';

class FakeNode {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.parentNode = null;
    this.style = {};
    this.textContent = '';
  }

  setAttribute() {}

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
    return Array.from(this.textContent).length * fontSize;
  }
}

function withFakeDocument(run) {
  const original = globalThis.document;
  globalThis.document = { createElementNS: (_namespace, tagName) => new FakeNode(tagName) };
  try {
    return run();
  } finally {
    globalThis.document = original;
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
