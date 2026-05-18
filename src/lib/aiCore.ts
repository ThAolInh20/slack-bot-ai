import { GoogleGenAI, Type } from '@google/genai'
import Anthropic from '@anthropic-ai/sdk'
import { botsConfig } from '../config/bots'

const geminiClient = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || ''
})

const fallbackModels = ['gemini-2.5-flash', 'gemini-2.5-flash-lite']

export async function analyzeRouter(historyText: string): Promise<string | null> {
  const botsDescriptions = Object.values(botsConfig).map(b => `- ID: ${b.id}\n  Persona: ${b.personaPrompt}`).join('\n\n')
  
  const prompt = `You are a routing agent for a Slack workspace.
Your job is to analyze the following conversation history and decide which bot is best suited to speak next, based on their personas.
IMPORTANT: To keep the conversation natural, DO NOT select the bot that sent the very last message in the history.
CRITICAL: You MUST always pick a bot to continue the conversation. The conversation is meant to run infinitely. Do not ever return an empty string for selected_bot_id unless absolutely necessary due to a system error. Always keep the conversation going!

Return ONLY a valid JSON object matching this schema:
{
  "selected_bot_id": "the ID of the bot",
  "reasoning": "why this bot was chosen"
}
Do not wrap it in markdown backticks.

Available Bots:
${botsDescriptions}

Conversation History (Last 10 messages):
${historyText}`

  const routerProvider = process.env.ROUTER_AI_PROVIDER || 'gemini'

  if (routerProvider === 'anthropic') {
    const anthropic = new Anthropic({
      apiKey: process.env.MINIMAX_API_KEY || '',
      baseURL: process.env.MINIMAX_API_URL || 'https://api.minimax.io/anthropic'
    })
    
    try {
      const msg = await anthropic.messages.create({
        model: process.env.ROUTER_AI_MODEL || 'MiniMax-Text-01',
        max_tokens: 1024,
        messages: [
          { role: 'user', content: prompt }
        ]
      })

      if (msg.content[0].type === 'text') {
        let text = msg.content[0].text.trim()
        // Strip markdown backticks if present
        text = text.replace(/^```json/i, '').replace(/```$/i, '').trim()
        const data = JSON.parse(text || '{}')
        return data.selected_bot_id || null
      }
      return null
    } catch (e: any) {
      console.error("[Router] Anthropic Router Error:", e.message || e)
      return null
    }
  }

  // DEFAULT GEMINI ROUTER
  let lastError;
  for (const modelName of fallbackModels) {
    try {
      const response = await geminiClient.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              selected_bot_id: { type: Type.STRING, description: "The ID of the bot to reply, or empty string if none." },
              reasoning: { type: Type.STRING, description: "Why this bot was chosen." }
            },
            required: ["selected_bot_id"]
          }
        }
      })

      const data = JSON.parse(response.text || '{}')
      return data.selected_bot_id || null
    } catch (e: any) {
      console.warn(`[Router] Model ${modelName} failed (Quota/Error): ${e.message || e}`)
      lastError = e
    }
  }
  
  console.error("Router AI Error: All fallback models exhausted.", lastError)
  return null
}

export async function generateReply(botId: string, personaPrompt: string, historyText: string): Promise<string | null> {
  const botConfig = botsConfig[botId]
  if (!botConfig) return null

  const prompt = `You are playing a role in a Slack workspace. 
Role instructions: ${personaPrompt}

Read the conversation history below and respond naturally to the latest message as your persona.
Conversation History:
${historyText}

Your response (trả lời tiếng việt):`

  // ANTHROPIC / MINIMAX PROVIDER
  if (botConfig.aiProvider === 'anthropic') {
    if (!botConfig.aiApiKey) {
      console.error(`[Worker] Anthropic API Key missing for bot ${botId}`)
      return null
    }
    try {
      const anthropic = new Anthropic({
        apiKey: botConfig.aiApiKey,
        baseURL: botConfig.aiBaseUrl // e.g., 'https://api.minimax.io/anthropic'
      })

      const msg = await anthropic.messages.create({
        model: botConfig.aiModel || 'MiniMax-Text-01',
        max_tokens: 1024,
        system: personaPrompt,
        messages: [
          { role: 'user', content: `Conversation History:\n${historyText}\n\nYour response (trả lời tiếng việt):` }
        ]
      })

      if (msg.content[0].type === 'text') {
        return msg.content[0].text
      }
      return null
    } catch (e: any) {
      console.error(`[Worker] Anthropic/Minimax Error for bot ${botId}:`, e.message || e)
      return null
    }
  }

  // DEFAULT GEMINI PROVIDER
  let lastError;
  for (const modelName of fallbackModels) {
    try {
      const response = await geminiClient.models.generateContent({
        model: modelName,
        contents: prompt
      })

      return response.text || null
    } catch (e: any) {
      console.warn(`[Worker] Model ${modelName} failed (Quota/Error): ${e.message || e}`)
      lastError = e
    }
  }

  console.error("Worker AI Error: All fallback models exhausted.", lastError)
  return null
}
