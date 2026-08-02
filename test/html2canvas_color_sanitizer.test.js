const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'html2canvas_color_sanitizer.js'), 'utf8');
const context = {
  window: {},
  console,
};
vm.createContext(context);
vm.runInContext(source, context);

const normalize = context.window.normalizeHtml2CanvasCloneColors;
assert.strictEqual(typeof normalize, 'function');

const originalChild = { id: 'child' };
const cloneChild = { style: { setProperty(name, value, priority) { this[name] = { value, priority }; } } };
const cloneRoot = {
  style: { setProperty(name, value, priority) { this[name] = { value, priority }; } },
  querySelectorAll(selector) {
    assert.strictEqual(selector, '*');
    return [cloneChild];
  },
};
const originalRoot = {
  querySelectorAll(selector) {
    assert.strictEqual(selector, '*');
    return [originalChild];
  },
};

context.window.getComputedStyle = (node) => {
  if (node === originalRoot) {
    return {
      color: 'color(display-p3 0.2 0.3 0.4)',
      backgroundColor: 'rgb(255, 255, 255)',
      borderTopColor: 'rgba(0, 0, 0, 0.1)',
      borderRightColor: 'rgb(0, 0, 0)',
      borderBottomColor: 'rgb(0, 0, 0)',
      borderLeftColor: 'rgb(0, 0, 0)',
      textDecorationColor: 'rgb(0, 0, 0)',
      outlineColor: 'rgb(0, 0, 0)',
      columnRuleColor: 'rgb(0, 0, 0)',
      caretColor: 'auto',
      fill: 'none',
      stroke: 'none',
    };
  }
  return {
    color: 'oklch(60% 0.12 240)',
    backgroundColor: 'lab(50% 10 20)',
    borderTopColor: 'color(srgb 1 0 0)',
    borderRightColor: 'rgb(0, 0, 0)',
    borderBottomColor: 'rgba(0, 0, 0, 0.2)',
    borderLeftColor: 'rgb(0, 0, 0)',
    textDecorationColor: 'rgb(0, 0, 0)',
    outlineColor: 'rgb(0, 0, 0)',
    columnRuleColor: 'rgb(0, 0, 0)',
    caretColor: 'auto',
    fill: 'none',
    stroke: 'none',
  };
};

normalize(originalRoot, cloneRoot);

assert.deepStrictEqual(cloneRoot.style.color, { value: '#0E1629', priority: 'important' });
assert.deepStrictEqual(cloneChild.style.color, { value: '#0E1629', priority: 'important' });
assert.deepStrictEqual(cloneChild.style.backgroundColor, { value: '#FFFFFF', priority: 'important' });
assert.deepStrictEqual(cloneChild.style.borderTopColor, { value: '#E5E7EB', priority: 'important' });
