/**
 * CSS Parser - Isomorphic Intelligence Layer
 * 
 * Parses CSS selectors and stylesheets to understand element styling
 * and structure for resilient selector generation.
 */

window.isomorphic = window.isomorphic || {};

window.isomorphic.cssParser = {
    /**
     * Parse CSS selector into components
     */
    parseSelector(selector) {
        const components = {
            tag: null,
            id: null,
            classes: [],
            attributes: [],
            pseudo: null,
            combinator: null
        };
        
        // Extract ID
        const idMatch = selector.match(/#([\w-]+)/);
        if (idMatch) {
            components.id = idMatch[1];
        }
        
        // Extract classes
        const classMatches = selector.match(/\.([\w-]+)/g);
        if (classMatches) {
            components.classes = classMatches.map(c => c.substring(1));
        }
        
        // Extract tag
        const tagMatch = selector.match(/^([a-z]+)/i);
        if (tagMatch) {
            components.tag = tagMatch[1];
        }
        
        // Extract attributes
        const attrMatches = selector.match(/\[([^\]]+)\]/g);
        if (attrMatches) {
            components.attributes = attrMatches.map(attr => attr.slice(1, -1));
        }
        
        return components;
    },
    
    /**
     * Get computed styles for element
     */
    getComputedStyles(element) {
        const styles = window.getComputedStyle(element);
        return {
            display: styles.display,
            visibility: styles.visibility,
            opacity: styles.opacity,
            position: styles.position,
            zIndex: styles.zIndex,
            color: styles.color,
            backgroundColor: styles.backgroundColor,
            fontSize: styles.fontSize,
            fontWeight: styles.fontWeight
        };
    },
    
    /**
     * Check if selector is likely to be stable
     */
    isStableSelector(selector) {
        // ID selectors are most stable
        if (selector.includes('#')) return true;
        
        // Data attributes are stable
        if (selector.includes('[data-')) return true;
        
        // Class selectors with semantic names are stable
        const semanticClasses = ['button', 'input', 'link', 'form', 'container', 'header', 'footer'];
        const hasSemantic = semanticClasses.some(sem => selector.includes(`.${sem}`));
        if (hasSemantic) return true;
        
        return false;
    }
};
