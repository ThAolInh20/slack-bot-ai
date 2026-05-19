import { FastifyInstance, FastifyPluginOptions } from 'fastify'
import { verifySlackSignature } from '../lib/slackUtils'
import { getBotConfig } from '../config/bots'
import { getQueueLength, triggerScriptGeneration } from '../lib/queueManager'

const processedEvents = new Set<string>()

export default async function slackRoutes(fastify: FastifyInstance, _opts: FastifyPluginOptions) {
  fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    done(null, body)
  })

  fastify.post<{ Params: { botId: string } }>('/slack/:botId/events', async (req, reply) => {
    const { botId } = req.params
    const botConfig = getBotConfig(botId)

    if (!botConfig) {
      fastify.log.warn(`Unknown bot ID: ${botId}`)
      return reply.code(404).send({ error: 'unknown_bot' })
    }

    const raw = req.body as Buffer
    const headers = req.headers

    if (!verifySlackSignature(raw, headers, botConfig.signingSecret)) {
      fastify.log.warn('Invalid Slack signature')
      return reply.code(401).send({ error: 'invalid_signature' })
    }

    let body: any
    try {
      body = JSON.parse(raw.toString('utf8'))
    } catch (err) {
      return reply.code(400).send({ error: 'invalid_json' })
    }

    if (body.type === 'url_verification') {
      return reply.code(200).send({ challenge: body.challenge })
    }

    if (body.type === 'event_callback' && body.event) {
      const ev = body.event

      const eventId = ev.client_msg_id || ev.ts
      if (eventId) {
        if (processedEvents.has(eventId)) {
          return reply.code(200).send({ ok: true })
        }
        processedEvents.add(eventId)
        if (processedEvents.size > 1000) processedEvents.clear()
      }

      if (ev.type === 'message' && ev.text && ev.channel) {
        // Kickstart script generation if queue is low
        if (getQueueLength(ev.channel) <= 2) {
          fastify.log.info({ channel: ev.channel }, 'Queue is low, triggering background script generation...');
          triggerScriptGeneration(ev.channel);
        }
      }
    }

    // Return 200 OK immediately to satisfy Slack's 3-second timeout rule
    return reply.code(200).send({ ok: true })
  })
}
