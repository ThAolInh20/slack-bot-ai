import 'dotenv/config'
import Fastify from 'fastify'
import slackRoutes from './routes/slack'
import { startQueueWorker } from './lib/queueManager'
const app = Fastify({ logger: true })

// Register application routes
app.register(slackRoutes)

const start = async () => {
  try {
    const port = Number(process.env.PORT || 3456)
    await app.listen({ port, host: '0.0.0.0' })
    app.log.info(`Server listening on ${port}`)
    
    // Bắt đầu background worker cho kịch bản chat
    startQueueWorker()
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

// Only start if this file is run directly
if (require.main === module) {
  start()
}

export default app
