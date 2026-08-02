(function () {
    const COLOR_PROPERTIES = [
        ['color', '#0E1629'],
        ['backgroundColor', '#FFFFFF'],
        ['borderTopColor', '#E5E7EB'],
        ['borderRightColor', '#E5E7EB'],
        ['borderBottomColor', '#E5E7EB'],
        ['borderLeftColor', '#E5E7EB'],
        ['textDecorationColor', '#0E1629'],
        ['outlineColor', '#E5E7EB'],
        ['columnRuleColor', '#E5E7EB'],
        ['caretColor', '#0E1629'],
        ['fill', '#0E1629'],
        ['stroke', '#0E1629'],
    ];

    const UNSUPPORTED_COLOR_RE = /\b(?:color|lab|lch|oklab|oklch)\(/i;

    function hasUnsupportedColor(value) {
        return typeof value === 'string' && UNSUPPORTED_COLOR_RE.test(value);
    }

    function normalizeHtml2CanvasCloneColors(originalRoot, cloneRoot) {
        if (!originalRoot || !cloneRoot || typeof window.getComputedStyle !== 'function') return;

        const originalNodes = [originalRoot].concat(Array.from(originalRoot.querySelectorAll('*')));
        const cloneNodes = [cloneRoot].concat(Array.from(cloneRoot.querySelectorAll('*')));

        originalNodes.forEach((originalNode, index) => {
            const cloneNode = cloneNodes[index];
            if (!cloneNode || !cloneNode.style) return;

            let computed;
            try {
                computed = window.getComputedStyle(originalNode);
            } catch (e) {
                return;
            }

            COLOR_PROPERTIES.forEach(([property, fallback]) => {
                const value = computed[property];
                if (hasUnsupportedColor(value)) {
                    cloneNode.style.setProperty(property, fallback, 'important');
                }
            });
        });
    }

    window.normalizeHtml2CanvasCloneColors = normalizeHtml2CanvasCloneColors;
})();
