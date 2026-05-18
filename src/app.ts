import Fastify from 'fastify'
import dotenv from 'dotenv'
import slackRoutes from './routes/slack'

dotenv.config()

const app = Fastify({ logger: true })

// Register application routes
app.register(slackRoutes)

const start = async () => {
  try {
    const port = Number(process.env.PORT || 3456)
    await app.listen({ port, host: '0.0.0.0' })
    app.log.info(`Server listening on ${port}`)
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
