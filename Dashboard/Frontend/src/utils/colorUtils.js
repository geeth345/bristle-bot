// utils/colorUtils.js

/**
 * Color utility functions for visualization
 * Provides consistent color schemes and color manipulation functions
 */
export const colorUtils = {
    /**
     * Convert a number to a HSL color string
     * Used to generate consistent colors from IDs
     * 
     * @param {number|string} value - Input value
     * @param {number} saturation - Color saturation (0-100)
     * @param {number} lightness - Color lightness (0-100)
     * @returns {string} HSL color string
     */
    hashToHSL: (value, saturation = 70, lightness = 50) => {
      let hash = 0;
      
      // Convert string to number if necessary
      if (typeof value === 'string') {
        for (let i = 0; i < value.length; i++) {
          hash = ((hash << 5) - hash) + value.charCodeAt(i);
          hash |= 0; // Convert to 32bit integer
        }
      } else if (typeof value === 'number') {
        hash = value;
      }
      
      // Map hash to hue (0-360)
      const hue = Math.abs(hash) % 360;
      
      return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    },
    
    /**
     * Adjust color lightness based on parameter
     * Useful for hover or selection states
     * 
     * @param {string} color - HSL color string
     * @param {number} amount - Amount to adjust (-100 to 100)
     * @returns {string} Adjusted HSL color
     */
    adjustLightness: (color, amount) => {
      // Extract HSL components
      const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
      if (!match) return color;
      
      const h = parseInt(match[1], 10);
      const s = parseInt(match[2], 10);
      let l = parseInt(match[3], 10);
      
      // Adjust lightness with clamping
      l = Math.max(0, Math.min(100, l + amount));
      
      return `hsl(${h}, ${s}%, ${l}%)`;
    },
    
    /**
     * Get appropriate text color (black/white) for given background
     * Ensures text is readable against any background
     * 
     * @param {string} backgroundColor - CSS color value
     * @returns {string} Text color ('black' or 'white')
     */
    getContrastText: (backgroundColor) => {
      // For HSL colors
      const hslMatch = backgroundColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
      if (hslMatch) {
        const l = parseInt(hslMatch[3], 10);
        return l > 60 ? 'black' : 'white';
      }
      
      // For hex colors
      if (backgroundColor.startsWith('#')) {
        let r, g, b;
        
        if (backgroundColor.length === 4) {
          // #RGB format
          r = parseInt(backgroundColor[1] + backgroundColor[1], 16);
          g = parseInt(backgroundColor[2] + backgroundColor[2], 16);
          b = parseInt(backgroundColor[3] + backgroundColor[3], 16);
        } else {
          // #RRGGBB format
          r = parseInt(backgroundColor.slice(1, 3), 16);
          g = parseInt(backgroundColor.slice(3, 5), 16);
          b = parseInt(backgroundColor.slice(5, 7), 16);
        }
        
        // Calc perceived brightness using YIQ formula
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return yiq >= 128 ? 'black' : 'white';
      }
      
      // Fallback
      return 'white';
    },
    
    /**
     * Get status color based on status string
     * 
     * @param {string} status - Status string
     * @returns {string} Color for status
     */
    statusToColor: (status) => {
      const statusColors = {
        'active': '#4caf50',    // Green
        'searching': '#ff9800', // Orange
        'returning': '#2196f3', // Blue
        'inactive': '#9e9e9e',  // Grey
        'error': '#f44336',     // Red
      };
      
      return statusColors[status] || '#f44336'; // Default to error/red
    },
    
    /**
     * Get battery color based on level
     * 
     * @param {number} level - Battery level (0-100)
     * @returns {string} Color for battery level
     */
    batteryLevelToColor: (level) => {
      if (level > 70) return '#4caf50'; // Green
      if (level > 40) return '#ff9800'; // Orange
      if (level > 20) return '#ff5722'; // Deep Orange
      return '#f44336'; // Red
    }
  };
  
  export default colorUtils;
  