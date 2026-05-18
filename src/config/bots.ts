export interface BotConfig {
  id: string
  token: string
  signingSecret: string
  replyRate: number
  alwaysReplyAccounts: string[]
  personaPrompt: string
  reactionRate: number
}

export const botsConfig: Record<string, BotConfig> = {
  // Example bot configuration. Add more bots here by adding prefix blocks in .env
  'senna': {
    id: 'senna',
    // Fallback to legacy SLACK_BOT_TOKEN for easier migration
    token: process.env.BOT1_TOKEN || process.env.SLACK_BOT_TOKEN || '',
    signingSecret: process.env.BOT1_SIGNING_SECRET || process.env.SLACK_SIGNING_SECRET || '',
    replyRate: 100, // 100% chance to reply by default

    alwaysReplyAccounts: ['U0AQ94AFPCL'], // Slack User IDs that always get a reply
    personaPrompt: 'You are Senna, a helpful and witty assistant.',
    reactionRate: 20, // 20% chance to react with an emoji
  },
  'ochabi': {
    id: 'ochabi',
    token: process.env.BOT2_TOKEN || '',
    signingSecret: process.env.BOT2_SIGNING_SECRET || '',
    replyRate: 50,
    alwaysReplyAccounts: ['U0AQ94AFPCL'],
    personaPrompt: 'You are Ochabi, a calm and precise assistant.',
    reactionRate: 10,
  }
}

export function getBotConfig(botId: string): BotConfig | undefined {
  return botsConfig[botId]
}
