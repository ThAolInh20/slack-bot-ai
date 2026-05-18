import { FastifyInstance, FastifyPluginOptions } from 'fastify'
import { verifySlackSignature, postSlackMessage, postSlackReaction } from '../lib/slackUtils'
import { getBotConfig } from '../config/bots'

export default async function slackRoutes(fastify: FastifyInstance, _opts: FastifyPluginOptions) {
  // Ensure we receive raw body for signature verification
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

      if (ev.type === 'message' && ev.text && ev.channel && botConfig.token) {
        fastify.log.info({ channel: ev.channel, user: ev.user, botId }, 'Received message from Slack')

        // 1. Reaction Logic
        const shouldReact = Math.random() * 100 <= botConfig.reactionRate
        if (shouldReact) {
          const emojis = ['eyes', 'fire', 'raised_hands', 'robot_face', 'thinking_face', 'sparkles']
          const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)]
          postSlackReaction(botConfig.token, ev.channel, ev.ts, randomEmoji)
            .catch(err => fastify.log.error(err, 'Failed to post reaction'))
        }

        // 2. Reply Logic
        let shouldReply = false
        if (ev.user && botConfig.alwaysReplyAccounts.includes(ev.user)) {
          shouldReply = true
        } else if (Math.random() * 100 <= botConfig.replyRate) {
          shouldReply = true
        }

        if (shouldReply) {
          try {
            // Incorporate persona for future Gemini integration
            const prefix = botConfig.personaPrompt ? `[${botConfig.personaPrompt}] ` : ''
            const resp = await postSlackMessage(botConfig.token, ev.channel, `${prefix}Echo from ${botId}: ${ev.text}`)
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
