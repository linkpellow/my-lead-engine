/**
 * Selector Parser - Isomorphic Intelligence Layer
 * 
 * Parses and validates CSS selectors, extracts element attributes,
 * and provides selector analysis for self-healing.
 */

window.isomorphic = window.isomorphic || {};

window.isomorphic.selectorParser = {
    /**
     * Parse a CSS selector and extract element information
     */
    parseSelector(selector) {
        try {
            const elements = document.querySelectorAll(selector);
            if (elements.length === 0) {
                return { valid: false, count: 0, error: 'No elements found' };
            }
            
            const firstElement = elements[0];
            const attributes = {};
            for (const attr of firstElement.attributes) {
                attributes[attr.name] = attr.value;
            }
            
            return {
                valid: true,
                count: elements.length,
                element: {
                    tagName: firstElement.tagName.toLowerCase(),
                    id: firstElement.id || null,
                    className: firstElement.className || null,
                    attributes: attributes,
                    text: firstElement.textContent?.trim().substring(0, 100) || null,
                    visible: this.isVisible(firstElement)
                }
            };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    },
    
    /**
     * Check if element is visible
     */
    isVisible(element) {
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               style.opacity !== '0' &&
               element.offsetWidth > 0 && 
               element.offsetHeight > 0;
    },
    
    /**
     * Extract unique identifiers from element
     */
    extractIdentifiers(element) {
        const identifiers = {
            id: element.id || null,
            classes: element.className ? element.className.split(/\s+/).filter(c => c) : [],
            attributes: {},
            text: element.textContent?.trim().substring(0, 50) || null,
            tagName: element.tagName.toLowerCase()
        };
        
        // Extract data attributes
        for (const attr of element.attributes) {
            if (attr.name.startsWith('data-')) {
                identifiers.attributes[attr.name] = attr.value;
            }
        }
        
        return identifiers;
    }
};
