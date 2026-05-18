import crypto from 'crypto'
import { WebClient } from '@slack/web-api'

export function verifySlackSignature(rawBody: Buffer, headers: any): boolean {
  const signingSecret = process.env.SLACK_SIGNING_SECRET || ''
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

export async function postSlackMessage(channel: string, text: string) {
  const token = process.env.SLACK_BOT_TOKEN || ''
  if (!token) throw new Error('missing_slack_token')
  const web = new WebClient(token)
  return web.chat.postMessage({ channel, text })
}
