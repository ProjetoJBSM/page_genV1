/**
 * Request Queue Manager
 * Handles batching and rate limiting of API requests to avoid hitting the 15 req/min limit
 */

export class RequestQueue {
  constructor(maxRequestsPerMinute = 15, delayBetweenRequests = 5000) {
    this.maxRequestsPerMinute = maxRequestsPerMinute
    this.delayBetweenRequests = delayBetweenRequests // Delay in ms between requests
    this.queue = []
    this.processing = false
    this.requestTimes = []
    this.results = new Map()
    this.errors = new Map()
    this.retryCount = new Map()
    this.maxRetries = 3
    
    // Callbacks
    this.onProgress = null
    this.onComplete = null
    this.onError = null
  }

  /**
   * Add a request to the queue
   * @param {string} id - Unique identifier for the request
   * @param {Function} requestFn - Async function that makes the API call
   * @param {number} priority - Higher numbers = higher priority
   */
  addRequest(id, requestFn, priority = 0) {
    // Check if already in queue or already processed
    if (this.queue.some(item => item.id === id) || this.results.has(id)) {
      console.log(`⊙ Request ${id} already queued/processed, skipping`)
      return
    }

    this.queue.push({
      id,
      requestFn,
      priority,
      addedAt: Date.now()
    })

    // Sort by priority (higher first)
    this.queue.sort((a, b) => b.priority - a.priority)

    console.log(`📝 Added request ${id} to queue (${this.queue.length} total)`)
  }

  /**
   * Start processing the queue
   */
  async start() {
    if (this.processing) {
      console.log('⚠️ Queue already processing')
      return
    }

    this.processing = true
    console.log(`🚀 Starting queue processing with ${this.queue.length} requests`)

    while (this.queue.length > 0) {
      // Check if we can make a request based on rate limit
      if (!this.canMakeRequest()) {
        const waitTime = this.getWaitTime()
        console.log(`⏳ Rate limit reached, waiting ${Math.ceil(waitTime / 1000)}s...`)
        await this.sleep(waitTime)
        continue
      }

      // Get next request
      const item = this.queue.shift()
      
      try {
        console.log(`🔄 Processing request ${item.id}...`)
        
        // Record request time
        this.requestTimes.push(Date.now())
        
        // Execute the request
        const startTime = Date.now()
        const result = await item.requestFn()
        const elapsed = Date.now() - startTime
        
        // Store result
        this.results.set(item.id, result)
        
        console.log(`✓ Request ${item.id} completed in ${elapsed}ms`)
        
        // Call progress callback
        if (this.onProgress) {
          this.onProgress({
            id: item.id,
            result,
            completed: this.results.size,
            total: this.results.size + this.queue.length,
            errors: this.errors.size
          })
        }

        // Clean up old request times (older than 1 minute)
        this.cleanupRequestTimes()
        
      } catch (error) {
        console.error(`✗ Request ${item.id} failed:`, error.message)
        
        // Check if we should retry
        const retries = this.retryCount.get(item.id) || 0
        if (retries < this.maxRetries) {
          console.log(`🔄 Retrying request ${item.id} (attempt ${retries + 1}/${this.maxRetries})`)
          this.retryCount.set(item.id, retries + 1)
          
          // Re-add to queue with higher priority
          this.queue.unshift({
            ...item,
            priority: item.priority + 10
          })
        } else {
          // Max retries reached, store error
          this.errors.set(item.id, error.message)
          
          if (this.onError) {
            this.onError({
              id: item.id,
              error: error.message,
              retries
            })
          }
        }
      }

      // Delay between requests (configurable, default 5 seconds for batch processing)
      await this.sleep(this.delayBetweenRequests)
    }

    this.processing = false
    console.log('✅ Queue processing completed')
    
    if (this.onComplete) {
      this.onComplete({
        results: this.results,
        errors: this.errors,
        totalProcessed: this.results.size,
        totalErrors: this.errors.size
      })
    }
  }

  /**
   * Pause queue processing
   */
  pause() {
    this.processing = false
    console.log('⏸️ Queue paused')
  }

  /**
   * Check if we can make a request based on rate limit
   */
  canMakeRequest() {
    const now = Date.now()
    const oneMinuteAgo = now - 60000
    
    // Count requests in the last minute
    const recentRequests = this.requestTimes.filter(time => time > oneMinuteAgo)
    
    return recentRequests.length < this.maxRequestsPerMinute
  }

  /**
   * Get time to wait before next request can be made
   */
  getWaitTime() {
    const now = Date.now()
    const oneMinuteAgo = now - 60000
    
    // Get oldest request in the last minute
    const recentRequests = this.requestTimes.filter(time => time > oneMinuteAgo)
    
    if (recentRequests.length < this.maxRequestsPerMinute) {
      return 0
    }
    
    // Wait until the oldest request is older than 1 minute
    const oldestRequest = Math.min(...recentRequests)
    return (oldestRequest + 60000) - now + 1000 // Add 1 second buffer
  }

  /**
   * Remove request times older than 1 minute
   */
  cleanupRequestTimes() {
    const oneMinuteAgo = Date.now() - 60000
    this.requestTimes = this.requestTimes.filter(time => time > oneMinuteAgo)
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      queued: this.queue.length,
      completed: this.results.size,
      errors: this.errors.size,
      processing: this.processing,
      canMakeRequest: this.canMakeRequest(),
      waitTime: this.getWaitTime()
    }
  }

  /**
   * Clear all results and reset
   */
  clear() {
    this.queue = []
    this.results.clear()
    this.errors.clear()
    this.retryCount.clear()
    this.requestTimes = []
    this.processing = false
    console.log('🗑️ Queue cleared')
  }

  /**
   * Helper sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
