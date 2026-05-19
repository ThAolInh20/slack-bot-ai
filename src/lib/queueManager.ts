import { postSlackMessage, getSlackHistory } from './slackUtils';
import { getBotConfig, botsConfig } from '../config/bots';
import { generateConversationScript, ScriptItem } from './aiCore';

const scriptQueues: Record<string, ScriptItem[]> = {};
const isGenerating: Record<string, boolean> = {};

export function getQueueLength(channel: string): number {
  return scriptQueues[channel]?.length || 0;
}

export function setGenerating(channel: string, generating: boolean) {
  isGenerating[channel] = generating;
}

export function getGenerating(channel: string): boolean {
  return !!isGenerating[channel];
}

export function triggerScriptGeneration(channel: string) {
  if (getGenerating(channel)) return;
  setGenerating(channel, true);
  
  console.log(`[Queue] Triggering script generation for channel ${channel}...`);
  
  // Run asynchronously
  (async () => {
    try {
      if (!scriptQueues[channel]) {
        scriptQueues[channel] = [];
      }

      // Pick any bot to fetch history
      const availableBotIds = Object.keys(botsConfig);
      if (availableBotIds.length === 0) throw new Error("No bots configured");
      const anyBotId = availableBotIds[0];
      const anyBotConfig = getBotConfig(anyBotId);
      
      if (!anyBotConfig || !anyBotConfig.token) {
        throw new Error("Cannot fetch history: missing bot token");
      }

      const historyMessages = await getSlackHistory(anyBotConfig.token, channel, undefined, 20);
      const historyText = historyMessages.map((m: any) => {
        const sender = m.bot_id ? `Bot_App_ID[${m.bot_id}]` : `User[${m.user}]`;
        return `${sender}: ${m.text}`;
      }).join('\n');
      
      const newItems = await generateConversationScript(historyText);
      
      if (newItems && newItems.length > 0) {
        scriptQueues[channel].push(...newItems);
        console.log(`[Queue] Successfully generated ${newItems.length} new messages for channel ${channel}.`);
      } else {
        console.warn(`[Queue] Generated 0 messages for channel ${channel}.`);
      }
    } catch (err) {
      console.error(`[Queue] Error generating script for channel ${channel}:`, err);
    } finally {
      setGenerating(channel, false);
    }
  })();
}

// Background worker that dispatches messages from the queue every 5 seconds
let workerInterval: NodeJS.Timeout | null = null;

export function startQueueWorker() {
  if (workerInterval) return; // already started

  console.log('[Queue] Starting background queue worker...');
  workerInterval = setInterval(async () => {
    for (const channel of Object.keys(scriptQueues)) {
      const queue = scriptQueues[channel];
      
      // Auto-trigger generation if queue is running low
      if (queue.length <= 2 && !getGenerating(channel)) {
        triggerScriptGeneration(channel);
      }

      // If we have messages, post the next one
      if (queue.length > 0) {
        const nextMsg = queue.shift();
        if (nextMsg) {
          const botCfg = getBotConfig(nextMsg.botId);
          if (botCfg && botCfg.token) {
            try {
              await postSlackMessage(botCfg.token, channel, nextMsg.text);
              console.log(`[Queue] Posted message as ${nextMsg.botId} to ${channel}. Queue remaining: ${queue.length}`);
            } catch (e) {
              console.error(`[Queue] Error posting message for ${nextMsg.botId}:`, e);
              // Discard message on error to avoid getting stuck
            }
          } else {
            console.warn(`[Queue] Missing token or config for bot ${nextMsg.botId}. Skipping message.`);
          }
        }
      }
    }
  }, 5000); // 5 seconds interval
}
