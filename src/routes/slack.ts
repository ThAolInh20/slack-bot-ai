import { FastifyInstance, FastifyPluginOptions } from 'fastify'
import { verifySlackSignature, postSlackMessage } from '../lib/slackUtils'

export default async function slackRoutes(fastify: FastifyInstance, _opts: FastifyPluginOptions) {
  // Ensure we receive raw body for signature verification
  fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    done(null, body)
  })

  fastify.post('/slack/events', async (req, reply) => {
    const raw = req.body as Buffer
    const headers = req.headers

    if (!verifySlackSignature(raw, headers)) {
      fastify.log.warn('Invalid Slack signature')
      return reply.code(401).send({ error: 'invalid_signature' })
    }

    let body: any
    try {
      body = JSON.parse(raw.toString('utf8'))
    } catch (err) {
      fastify.log.error('Invalid JSON body')
      return reply.code(400).send({ error: 'invalid_json' })
    }

    if (body.type === 'url_verification') {
      return reply.code(200).send({ challenge: body.challenge })
    }

    if (body.type === 'event_callback' && body.event) {
      const ev = body.event
      // ignore bot messages and message changes
      if (ev.subtype === 'bot_message') return reply.code(200).send({ ok: true })

      if (ev.type === 'message' && ev.text && ev.channel) {
        fastify.log.info({ channel: ev.channel }, 'Received message from Slack')
        // If a Slack bot token is configured, send a reply via Web API
        if (process.env.SLACK_BOT_TOKEN) {
          try {
            const resp = await postSlackMessage(ev.channel, `Echo: ${ev.text}`)
            fastify.log.info({ resp }, 'Replied to Slack')
          } catch (err) {
            fastify.log.error(err, 'Failed to post reply to Slack')
          }
        }
      }
    }

    return reply.code(200).send({ ok: true })
  })
}
