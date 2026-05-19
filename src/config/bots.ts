import fs from 'fs'
import path from 'path'

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

function loadPrompt(botId: string, fallbackText: string): string {
  try {
    const promptPath = path.join(__dirname, '..', 'prompts', `${botId}.txt`);
    if (fs.existsSync(promptPath)) {
      return fs.readFileSync(promptPath, 'utf8').trim();
    }
  } catch (error) {
    console.error(`Failed to load prompt for ${botId}:`, error);
  }
  return fallbackText;
}

export const botsConfig: Record<string, BotConfig> = {
  'senna': {
    id: 'senna',
    token: process.env.BOT1_TOKEN || process.env.SLACK_BOT_TOKEN || '',
    signingSecret: process.env.BOT1_SIGNING_SECRET || process.env.SLACK_SIGNING_SECRET || '',
    replyRate: 100,
    alwaysReplyAccounts: ['U0AQ94AFPCL'],
    personaPrompt: loadPrompt('senna', 'Bạn là senna, chủ cửa hàng tiện lợi với nhiều năm kinh nghiệm bán hàng...'),
    reactionRate: 20,
    aiProvider: 'gemini'
  },
  'ochabi': {
    id: 'ochabi',
    token: process.env.BOT2_TOKEN || '',
    signingSecret: process.env.BOT2_SIGNING_SECRET || '',
    replyRate: 50,
    alwaysReplyAccounts: ['U0AQ94AFPCL'],
    personaPrompt: loadPrompt('ochabi', 'You are Ochabi, a calm and precise assistant.'),
    reactionRate: 10,
    aiProvider: 'gemini'
  },
  'oskar': {
    id: 'oskar',
    token: process.env.BOT3_TOKEN || '',
    signingSecret: process.env.BOT3_SIGNING_SECRET || '',
    replyRate: 50,
    alwaysReplyAccounts: ['U0AQ94AFPCL'],
    personaPrompt: loadPrompt('oskar', 'You are Oskar, a highly intelligent AI assistant powered by Minimax...'),
    reactionRate: 10,
    aiProvider: 'gemini'
  }
}

export function getBotConfig(botId: string): BotConfig | undefined {
  return botsConfig[botId]
}
