import { FastifyInstance, FastifyPluginOptions } from 'fastify'
import { verifySlackSignature, postSlackMessage, getSlackHistory } from '../lib/slackUtils'
import { getBotConfig } from '../config/bots'
import { analyzeRouter, generateReply } from '../lib/aiCore'

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
        // Run AI Pipeline in background so we can return 200 OK to Slack immediately (avoiding 3s timeout)
        ;(async () => {
          try {
            fastify.log.info({ channel: ev.channel, user: ev.user, eventId }, 'Background: Fetching history...')
            
            const historyMessages = await getSlackHistory(botConfig.token, ev.channel, ev.thread_ts, 10)
            
            const historyText = historyMessages.map((m: any) => {
              const sender = m.bot_id ? `Bot_App_ID[${m.bot_id}]` : `User[${m.user}]`
              return `${sender}: ${m.text}`
            }).join('\n')

            fastify.log.info('Background: Starting AI Router...')
            let selectedBotId = await analyzeRouter(historyText)
            
            if (selectedBotId) {
              selectedBotId = selectedBotId.toLowerCase().trim()
              const targetBotConfig = getBotConfig(selectedBotId)
              if (targetBotConfig && targetBotConfig.token) {
                fastify.log.info({ selectedBotId }, 'Background: Router selected bot. Starting AI Worker...')
                
                const replyText = await generateReply(selectedBotId, targetBotConfig.personaPrompt, historyText)
                
                if (replyText) {
                  // Artificial Delay to prevent API spam and make conversation natural
                  await new Promise(resolve => setTimeout(resolve, 3000))
                  
                  await postSlackMessage(targetBotConfig.token, ev.channel, replyText)
                  fastify.log.info({ selectedBotId }, 'Background: Replied to Slack via AI Worker')
                }
              }
            } else {
              fastify.log.info('Background: Router decided no bot should reply.')
            }
          } catch (err) {
            fastify.log.error(err, 'Background AI process failed')
          }
        })()
      }
    }

    // Return 200 OK immediately to satisfy Slack's 3-second timeout rule
    return reply.code(200).send({ ok: true })
  })
}
