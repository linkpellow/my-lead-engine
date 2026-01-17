const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

const port = parseInt(process.env.PORT || '3000', 10)
const hostname = '0.0.0.0'

console.log(`🚀 Starting Next.js server on ${hostname}:${port}`)
console.log(`📝 Environment: ${process.env.NODE_ENV || 'production'}`)

// Initialize Next.js app
const app = next({
  dev: false,  // Always production for Railway
  hostname: hostname,
  port: port
})

const handle = app.getRequestHandler()

// Start the server
const server = createServer((req, res) => {
  try {
    const parsedUrl = parse(req.url, true)
    handle(req, res, parsedUrl)
  } catch (error) {
    console.error('Request error:', error)
    res.statusCode = 500
    res.end('Internal Server Error')
  }
})

// Prepare Next.js and start listening
app.prepare()
  .then(() => {
    console.log('✅ Next.js app prepared successfully')
    return new Promise((resolve, reject) => {
      server.listen(port, hostname, (err) => {
        if (err) {
          console.error('❌ Server failed to start:', err)
          reject(err)
        } else {
          console.log(`🎉 Server ready on http://${hostname}:${port}`)
          console.log('💚 Health check endpoint: /')
          resolve()
        }
      })
    })
  })
  .catch((error) => {
    console.error('❌ Failed to prepare Next.js app:', error)
    process.exit(1)
  })

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully')
  server.close(() => {
    console.log('✅ Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully')
  server.close(() => {
    console.log('✅ Server closed')
    process.exit(0)
  })
})