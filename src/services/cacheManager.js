/**
 * Cache Manager for AI Responses
 * Stores AI-generated content in localStorage to:
 * 1. Prevent data loss on page refresh
 * 2. Avoid duplicate API calls for the same species/data
 * 3. Resume interrupted processing
 */

export class CacheManager {
  constructor(namespace = 'botanicGarden') {
    this.namespace = namespace
    this.cachePrefix = `${namespace}_cache_`
    this.progressPrefix = `${namespace}_progress_`
    this.metadataKey = `${namespace}_metadata`
  }

  /**
   * Generate a cache key based on prompt and context
   * For botanical data, this typically includes species information
   * @param {string} prompt - The AI prompt
   * @param {Object} rowData - The row data used to generate the prompt
   * @returns {string} - Cache key
   */
  generateCacheKey(prompt, rowData) {
    // Create a normalized key based on the actual prompt content
    // This ensures identical prompts (after substitution) share the same cache
    const normalized = prompt.toLowerCase().trim()
    
    // Create hash-like key (simple but effective)
    let hash = 0
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    
    return `prompt_${Math.abs(hash)}`
  }

  /**
   * Get cached response for a prompt
   * @param {string} cacheKey - Cache key
   * @returns {string|null} - Cached response or null
   */
  get(cacheKey) {
    try {
      const fullKey = this.cachePrefix + cacheKey
      const cached = localStorage.getItem(fullKey)
      
      if (cached) {
        const data = JSON.parse(cached)
        
        // Check if cache has expired (optional, set to 30 days)
        const maxAge = 30 * 24 * 60 * 60 * 1000 // 30 days
        if (Date.now() - data.timestamp > maxAge) {
          console.log(`🗑️ Cache expired for key: ${cacheKey}`)
          this.delete(cacheKey)
          return null
        }
        
        console.log(`💾 Cache hit for key: ${cacheKey}`)
        return data.response
      }
      
      return null
    } catch (error) {
      console.error('Error reading cache:', error)
      return null
    }
  }

  /**
   * Store response in cache
   * @param {string} cacheKey - Cache key
   * @param {string} response - AI response to cache
   * @param {Object} metadata - Additional metadata
   */
  set(cacheKey, response, metadata = {}) {
    try {
      const fullKey = this.cachePrefix + cacheKey
      const data = {
        response,
        timestamp: Date.now(),
        metadata
      }
      
      localStorage.setItem(fullKey, JSON.stringify(data))
      console.log(`💾 Cached response for key: ${cacheKey}`)
      
      // Update metadata
      this.updateMetadata()
    } catch (error) {
      console.error('Error writing cache:', error)
      
      // If quota exceeded, try clearing old cache
      if (error.name === 'QuotaExceededError') {
        console.log('🗑️ Quota exceeded, clearing old cache...')
        this.clearOldCache()
        
        // Try again
        try {
          const fullKey = this.cachePrefix + cacheKey
          const data = { response, timestamp: Date.now(), metadata }
          localStorage.setItem(fullKey, JSON.stringify(data))
        } catch (retryError) {
          console.error('Failed to cache even after cleanup:', retryError)
        }
      }
    }
  }

  /**
   * Delete a cached item
   * @param {string} cacheKey - Cache key
   */
  delete(cacheKey) {
    try {
      const fullKey = this.cachePrefix + cacheKey
      localStorage.removeItem(fullKey)
      console.log(`🗑️ Deleted cache for key: ${cacheKey}`)
    } catch (error) {
      console.error('Error deleting cache:', error)
    }
  }

  /**
   * Save processing progress
   * @param {string} sessionId - Unique session identifier (e.g., filename + timestamp)
   * @param {Object} progress - Progress data
   */
  saveProgress(sessionId, progress) {
    try {
      const fullKey = this.progressPrefix + sessionId
      const data = {
        ...progress,
        lastUpdated: Date.now()
      }
      
      localStorage.setItem(fullKey, JSON.stringify(data))
      console.log(`💾 Saved progress for session: ${sessionId}`)
    } catch (error) {
      console.error('Error saving progress:', error)
    }
  }

  /**
   * Load processing progress
   * @param {string} sessionId - Unique session identifier
   * @returns {Object|null} - Progress data or null
   */
  loadProgress(sessionId) {
    try {
      const fullKey = this.progressPrefix + sessionId
      const saved = localStorage.getItem(fullKey)
      
      if (saved) {
        const data = JSON.parse(saved)
        console.log(`💾 Loaded progress for session: ${sessionId}`)
        return data
      }
      
      return null
    } catch (error) {
      console.error('Error loading progress:', error)
      return null
    }
  }

  /**
   * Clear progress for a session
   * @param {string} sessionId - Unique session identifier
   */
  clearProgress(sessionId) {
    try {
      const fullKey = this.progressPrefix + sessionId
      localStorage.removeItem(fullKey)
      console.log(`🗑️ Cleared progress for session: ${sessionId}`)
    } catch (error) {
      console.error('Error clearing progress:', error)
    }
  }

  /**
   * Get all cache keys
   * @returns {Array} - Array of cache keys
   */
  getAllCacheKeys() {
    const keys = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(this.cachePrefix)) {
        keys.push(key.replace(this.cachePrefix, ''))
      }
    }
    return keys
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache stats
   */
  getStats() {
    const cacheKeys = this.getAllCacheKeys()
    let totalSize = 0
    let oldestTimestamp = Date.now()
    let newestTimestamp = 0
    
    cacheKeys.forEach(key => {
      const fullKey = this.cachePrefix + key
      const item = localStorage.getItem(fullKey)
      if (item) {
        totalSize += item.length
        try {
          const data = JSON.parse(item)
          if (data.timestamp < oldestTimestamp) oldestTimestamp = data.timestamp
          if (data.timestamp > newestTimestamp) newestTimestamp = data.timestamp
        } catch (e) {
          // Ignore parsing errors
        }
      }
    })
    
    return {
      count: cacheKeys.length,
      totalSizeBytes: totalSize,
      totalSizeKB: (totalSize / 1024).toFixed(2),
      oldestCache: oldestTimestamp !== Date.now() ? new Date(oldestTimestamp) : null,
      newestCache: newestTimestamp !== 0 ? new Date(newestTimestamp) : null
    }
  }

  /**
   * Clear old cache entries (older than specified days)
   * @param {number} days - Age threshold in days
   */
  clearOldCache(days = 30) {
    const maxAge = days * 24 * 60 * 60 * 1000
    const now = Date.now()
    let cleared = 0
    
    const keys = this.getAllCacheKeys()
    keys.forEach(key => {
      const fullKey = this.cachePrefix + key
      const item = localStorage.getItem(fullKey)
      if (item) {
        try {
          const data = JSON.parse(item)
          if (now - data.timestamp > maxAge) {
            localStorage.removeItem(fullKey)
            cleared++
          }
        } catch (e) {
          // Remove invalid entries
          localStorage.removeItem(fullKey)
          cleared++
        }
      }
    })
    
    console.log(`🗑️ Cleared ${cleared} old cache entries`)
    return cleared
  }

  /**
   * Clear all cache
   */
  clearAll() {
    const keys = this.getAllCacheKeys()
    keys.forEach(key => {
      const fullKey = this.cachePrefix + key
      localStorage.removeItem(fullKey)
    })
    
    // Clear progress data
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key && key.startsWith(this.progressPrefix)) {
        localStorage.removeItem(key)
      }
    }
    
    // Clear metadata
    localStorage.removeItem(this.metadataKey)
    
    console.log(`🗑️ Cleared all cache (${keys.length} items)`)
  }

  /**
   * Update metadata (cache tracking)
   */
  updateMetadata() {
    try {
      const metadata = {
        lastUpdated: Date.now(),
        version: '1.0.0'
      }
      localStorage.setItem(this.metadataKey, JSON.stringify(metadata))
    } catch (error) {
      console.error('Error updating metadata:', error)
    }
  }

  /**
   * Export cache data (for debugging or backup)
   * @returns {Object} - Cache data
   */
  exportCache() {
    const cache = {}
    const keys = this.getAllCacheKeys()
    
    keys.forEach(key => {
      const fullKey = this.cachePrefix + key
      const item = localStorage.getItem(fullKey)
      if (item) {
        try {
          cache[key] = JSON.parse(item)
        } catch (e) {
          console.error(`Error parsing cache item ${key}:`, e)
        }
      }
    })
    
    return cache
  }

  /**
   * Import cache data
   * @param {Object} cacheData - Cache data to import
   */
  importCache(cacheData) {
    Object.entries(cacheData).forEach(([key, value]) => {
      const fullKey = this.cachePrefix + key
      try {
        localStorage.setItem(fullKey, JSON.stringify(value))
      } catch (error) {
        console.error(`Error importing cache item ${key}:`, error)
      }
    })
    
    console.log(`💾 Imported ${Object.keys(cacheData).length} cache items`)
  }
}

// Create singleton instance
export const cacheManager = new CacheManager()
