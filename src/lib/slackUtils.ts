import crypto from 'crypto'
import { WebClient } from '@slack/web-api'

export function verifySlackSignature(rawBody: Buffer, headers: any, signingSecret: string): boolean {
  const sig = headers['x-slack-signature'] as string | undefined
  const ts = headers['x-slack-request-timestamp'] as string | undefined
  if (!sig || !ts || !signingSecret) return false
  const fiveMinutes = 60 * 5
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(ts)) > fiveMinutes) return false

  const base = `v0:${ts}:${rawBody.toString('utf8')}`
  const hmac = crypto.createHmac('sha256', signingSecret).update(base).digest('hex')
  const expected = `v0=${hmac}`
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))
  } catch (err) {
    return false
  }
}

export async function postSlackMessage(token: string, channel: string, text: string) {
  if (!token) throw new Error('missing_slack_token')
  const web = new WebClient(token)
  return web.chat.postMessage({ channel, text })
}

export async function postSlackReaction(token: string, channel: string, timestamp: string, emoji: string) {
  if (!token) throw new Error('missing_slack_token')
  const web = new WebClient(token)
  return web.reactions.add({ channel, timestamp, name: emoji })
}

export async function getSlackHistory(token: string, channel: string, thread_ts?: string, limit: number = 10) {
  if (!token) throw new Error('missing_slack_token')
  const web = new WebClient(token)
  
  try {
    if (thread_ts) {
      const res = await web.conversations.replies({ channel, ts: thread_ts, limit })
      return res.messages || []
    } else {
      const res = await web.conversations.history({ channel, limit })
      return (res.messages || []).reverse() // reverse to get chronological order
    }
  } catch (err) {
    console.error('Error fetching slack history:', err)
    return []
  }
}
