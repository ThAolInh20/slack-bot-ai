import { GoogleGenAI } from '@google/genai'
import Anthropic from '@anthropic-ai/sdk'
import { botsConfig } from '../config/bots'

const geminiClient = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || ''
})

const fallbackModels = ['gemini-2.5-flash', 'gemini-2.5-flash-lite']

export type ScriptItem = { botId: string; text: string }

export function parseScript(text: string): ScriptItem[] {
  const items: ScriptItem[] = []
  const lines = text.split('\n')
  const validBotIds = Object.keys(botsConfig)

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const firstPipeIndex = trimmed.indexOf('|')
    if (firstPipeIndex > 0) {
      const botId = trimmed.slice(0, firstPipeIndex).trim()
      const msgText = trimmed.slice(firstPipeIndex + 1).trim()

      // Basic validation
      if (validBotIds.includes(botId) && msgText) {
        items.push({ botId, text: msgText })
      }
    }
  }
  return items
}

export async function generateConversationScript(historyText: string): Promise<ScriptItem[]> {
  const botsDescriptions = Object.values(botsConfig).map(b => `- ID: ${b.id}\n  Persona: ${b.personaPrompt}`).join('\n\n')

  const prompt = `You are the lead scriptwriter for an ongoing group chat.
Your job is to generate the next 100-200 messages for the conversation, making it natural, engaging, and aligned with each bot's persona.
Read the conversation history and continue the dialogue.
Đảm bảo luôn có nội dung mới sau khoảng 20-30 lần chat(có mở đầu, thân, kết thúc)
CRITICAL RULES:
Các bot bớt chia sẻ về bản thân, mà điều đó nên dc thể hiện qua phong cách nói
Kịch bản nên giống 1 cuộc cãi vã nơi các ai có cái tôi cao, thích thể hiện

nó nên mang tính drama, nơi các ai ko thích nhau, và thích chê bai người khác, còn bản thân thì tự cao


AVAILABLE BOTS:
${botsDescriptions}

OUTPUT FORMAT:
You MUST output ONLY a Pipe-Separated Values (PSV) format. No markdown blocks, no JSON, no explanations.
Format: botId|message
Example:
senna|Chào mọi người!
ochabi|Chào Senna, hôm nay thế nào?
minimax_bot|Hệ thống đang hoạt động bình thường.

CRITICAL RULES:
1. Generate between 100 to 200 lines. The conversation must be long!
2. Do not include markdown code block backticks (like \`\`\`).
3. Each line must start with a valid bot ID exactly matching one of the available bots, followed by a pipe character "|", followed by their message.
4. Speak in Vietnamese (trả lời tiếng việt).

Conversation History (Last 20 messages):
${historyText}`

  const aiProvider = process.env.ROUTER_AI_PROVIDER || 'gemini'

  if (aiProvider === 'anthropic') {
    const anthropic = new Anthropic({
      apiKey: process.env.MINIMAX_API_KEY || '',
      baseURL: process.env.MINIMAX_API_URL || 'https://api.minimax.io/anthropic'
    })

    try {
      const msg = await anthropic.messages.create({
        model: process.env.ROUTER_AI_MODEL || 'MiniMax-Text-01',
        max_tokens: 8192,
        messages: [
          { role: 'user', content: prompt }
        ]
      })

      if (msg.content[0].type === 'text') {
        let text = msg.content[0].text.trim()
        text = text.replace(/^```[a-z]*\n/i, '').replace(/\n```$/i, '').trim()
        return parseScript(text)
      }
      return []
    } catch (e: any) {
      console.error("[ScriptGen] Anthropic/Minimax Error:", e.message || e)
      return []
    }
  }

  // DEFAULT GEMINI
  let lastError;
  for (const modelName of fallbackModels) {
    try {
      const response = await geminiClient.models.generateContent({
        model: modelName,
        contents: prompt
      })

      let text = response.text?.trim() || ''
      text = text.replace(/^```[a-z]*\n/i, '').replace(/\n```$/i, '').trim()

      const parsed = parseScript(text)
      if (parsed.length > 0) return parsed;
      console.warn(`[ScriptGen] Model ${modelName} returned 0 valid lines. Text: ${text.slice(0, 100)}...`)
    } catch (e: any) {
      console.warn(`[ScriptGen] Model ${modelName} failed: ${e.message || e}`)
      lastError = e
    }
  }

  console.error("ScriptGen Error: All fallback models exhausted or failed.", lastError)
  return []
}
