export interface BotConfig {
  id: string
  token: string
  signingSecret: string
  replyRate: number
  alwaysReplyAccounts: string[]
  personaPrompt: string
  reactionRate: number
  
  // Optional AI Provider settings
  aiProvider?: 'gemini' | 'anthropic'
  aiModel?: string
  aiBaseUrl?: string
  aiApiKey?: string
}

export const botsConfig: Record<string, BotConfig> = {
  'senna': {
    id: 'senna',
    token: process.env.BOT1_TOKEN || process.env.SLACK_BOT_TOKEN || '',
    signingSecret: process.env.BOT1_SIGNING_SECRET || process.env.SLACK_SIGNING_SECRET || '',
    replyRate: 100,
    alwaysReplyAccounts: ['U0AQ94AFPCL'],
    personaPrompt: 'You are Senna, a helpful and witty assistant.',
    reactionRate: 20,
    aiProvider: 'gemini'
  },
  'ochabi': {
    id: 'ochabi',
    token: process.env.BOT2_TOKEN || '',
    signingSecret: process.env.BOT2_SIGNING_SECRET || '',
    replyRate: 50,
    alwaysReplyAccounts: ['U0AQ94AFPCL'],
    personaPrompt: 'You are Ochabi, a calm and precise assistant.',
    reactionRate: 10,
    aiProvider: 'gemini'
  },
  'minimax_bot': {
    id: 'minimax_bot',
    token: process.env.BOT3_TOKEN || '',
    signingSecret: process.env.BOT3_SIGNING_SECRET || '',
    replyRate: 100,
    alwaysReplyAccounts: ['U0AQ94AFPCL'],
    personaPrompt: 'You are Mini, a highly intelligent AI assistant powered by Minimax. You speak logically and concisely.',
    reactionRate: 10,
    aiProvider: 'anthropic',
    aiBaseUrl: process.env.MINIMAX_API_URL || 'https://api.minimax.io/anthropic',
    aiModel: process.env.MINIMAX_API_MODEL || 'MiniMax-Text-01',
    aiApiKey: process.env.MINIMAX_API_KEY
  }
}

export function getBotConfig(botId: string): BotConfig | undefined {
  return botsConfig[botId]
}
