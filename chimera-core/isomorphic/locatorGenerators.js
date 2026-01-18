/**
 * Locator Generators - Isomorphic Intelligence Layer
 * 
 * Generates resilient CSS selectors and XPath locators for elements.
 * Used for self-healing when selectors break.
 */

window.isomorphic = window.isomorphic || {};

window.isomorphic.locatorGenerators = {
    /**
     * Generate resilient selector for element
     */
    generateResilientSelector(element, options = {}) {
        if (!element) {
            return null;
        }
        
        const strategies = options.strategies || ['id', 'data-attr', 'text', 'class', 'tag'];
        const selectors = [];
        
        // Strategy 1: ID selector (most stable)
        if (strategies.includes('id') && element.id) {
            selectors.push(`#${element.id}`);
        }
        
        // Strategy 2: Data attributes (stable)
        if (strategies.includes('data-attr')) {
            for (const attr of element.attributes) {
                if (attr.name.startsWith('data-')) {
                    selectors.push(`[${attr.name}="${attr.value}"]`);
                    break; // Use first data attribute
                }
            }
        }
        
        // Strategy 3: Text content (for buttons, links)
        if (strategies.includes('text') && element.textContent) {
            const text = element.textContent.trim().substring(0, 30);
            if (text && text.length > 0) {
                // Use XPath for text-based selection
                const xpath = `//${element.tagName.toLowerCase()}[contains(text(), "${text}")]`;
                selectors.push({ type: 'xpath', value: xpath });
            }
        }
        
        // Strategy 4: Class selector (if semantic)
        if (strategies.includes('class') && element.className) {
            const classes = element.className.split(/\s+/).filter(c => c);
            // Prefer semantic class names
            const semanticClasses = classes.filter(c => 
                /button|input|link|form|container|header|footer|nav|menu/i.test(c)
            );
            if (semanticClasses.length > 0) {
                selectors.push(`.${semanticClasses[0]}`);
            } else if (classes.length > 0) {
                selectors.push(`.${classes[0]}`);
            }
        }
        
        // Strategy 5: Tag + attributes
        if (strategies.includes('tag')) {
            const tag = element.tagName.toLowerCase();
            const attrSelectors = [];
            
            // Add type attribute for inputs
            if (element.type) {
                attrSelectors.push(`[type="${element.type}"]`);
            }
            
            // Add name attribute
            if (element.name) {
                attrSelectors.push(`[name="${element.name}"]`);
            }
            
            if (attrSelectors.length > 0) {
                selectors.push(`${tag}${attrSelectors.join('')}`);
            } else {
                selectors.push(tag);
            }
        }
        
        // Return most stable selector first
        return selectors.length > 0 ? selectors[0] : null;
    },
    
    /**
     * Generate multiple selector candidates
     */
    generateSelectorCandidates(element, maxCandidates = 5) {
        const candidates = [];
        
        // ID selector
        if (element.id) {
            candidates.push({ selector: `#${element.id}`, confidence: 0.95, type: 'id' });
        }
        
        // Data attributes
        for (const attr of element.attributes) {
            if (attr.name.startsWith('data-') && candidates.length < maxCandidates) {
                candidates.push({
                    selector: `[${attr.name}="${attr.value}"]`,
                    confidence: 0.90,
                    type: 'data-attr'
                });
            }
        }
        
        // Class selectors
        if (element.className) {
            const classes = element.className.split(/\s+/).filter(c => c);
            for (const cls of classes.slice(0, 2)) {
                if (candidates.length < maxCandidates) {
                    candidates.push({
                        selector: `.${cls}`,
                        confidence: 0.70,
                        type: 'class'
                    });
                }
            }
        }
        
        // Tag + attributes
        const tag = element.tagName.toLowerCase();
        if (element.type) {
            candidates.push({
                selector: `${tag}[type="${element.type}"]`,
                confidence: 0.75,
                type: 'tag-attr'
            });
        }
        
        return candidates.sort((a, b) => b.confidence - a.confidence);
    },
    
    /**
     * Find element by multiple strategies (self-healing)
     */
    findElementByStrategies(originalSelector, context = document) {
        // Try original selector first
        try {
            const element = context.querySelector(originalSelector);
            if (element) return { element, selector: originalSelector, method: 'original' };
        } catch (e) {
            // Selector is invalid, continue to alternatives
        }
        
        // Parse original selector to understand intent
        const parsed = window.isomorphic.cssParser.parseSelector(originalSelector);
        
        // Strategy 1: Try by ID if original had ID
        if (parsed.id) {
            const element = context.querySelector(`#${parsed.id}`);
            if (element) return { element, selector: `#${parsed.id}`, method: 'id-fallback' };
        }
        
        // Strategy 2: Try by classes
        if (parsed.classes.length > 0) {
            for (const cls of parsed.classes) {
                const element = context.querySelector(`.${cls}`);
                if (element) return { element, selector: `.${cls}`, method: 'class-fallback' };
            }
        }
        
        // Strategy 3: Try by tag
        if (parsed.tag) {
            const elements = context.querySelectorAll(parsed.tag);
            if (elements.length === 1) {
                return { element: elements[0], selector: parsed.tag, method: 'tag-fallback' };
            }
        }
        
        return null;
    }
};
