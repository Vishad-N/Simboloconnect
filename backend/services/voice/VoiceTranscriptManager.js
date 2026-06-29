const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');

class VoiceTranscriptManager {
  /**
   * Add a single transcript line
   */
  static async addTranscriptLine(sessionId, speaker, message) {
    return await prisma.voiceTranscript.create({
      data: {
        sessionId,
        speaker,
        message,
        timestamp: new Date()
      }
    });
  }

  /**
   * Automatically process, summarize, and score a finished call session
   */
  static async processAndSummarizeSession(sessionId) {
    try {
      const session = await prisma.voiceCallSession.findUnique({
        where: { id: sessionId },
        include: { transcripts: true }
      });

      if (!session || session.transcripts.length === 0) {
        return;
      }

      // Format conversation for AI
      const conversationText = session.transcripts
        .map(t => `${t.speaker}: ${t.message}`)
        .join('\n');

      // Call OpenAI / local LLM service to summarize & score
      const prompt = `You are a voice call analyzer. Analyze this conversation between AI and customer.
Provide a 1-sentence summary, a lead score (0 to 100 based on purchase intent), and list any follow-up actions.
Format output as JSON: { "summary": "...", "leadScore": 85, "conversion": true }

Conversation:
${conversationText}`;

      let summary = 'Conversation completed.';
      let leadScore = 50;

      // Integrate with existing AI service / OpenAI client
      if (process.env.OPENAI_API_KEY) {
        try {
          const { Configuration, OpenAIApi } = require('openai');
          const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
          const openai = new OpenAIApi(configuration);
          const aiResponse = await openai.createChatCompletion({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' }
          });
          const parsed = JSON.parse(aiResponse.data.choices[0].message.content);
          summary = parsed.summary || summary;
          leadScore = parsed.leadScore ?? leadScore;
        } catch (e) {
          console.error('[VoiceTranscriptManager] OpenAI summarization failed:', e.message);
        }
      }

      // Update call session
      await prisma.voiceCallSession.update({
        where: { id: sessionId },
        data: {
          summary,
          leadScore,
          status: 'COMPLETED'
        }
      });

      // Update Voice Usage Minutes
      const durationSec = session.durationSeconds || 60;
      const minutesUsed = Math.ceil(durationSec / 60);

      await prisma.voiceUsage.upsert({
        where: { userId: session.userId },
        update: {
          dailyMinutes: { increment: minutesUsed },
          monthlyMinutes: { increment: minutesUsed },
          totalCalls: { increment: 1 }
        },
        create: {
          userId: session.userId,
          dailyMinutes: minutesUsed,
          monthlyMinutes: minutesUsed,
          totalCalls: 1
        }
      });

      // Also log billing record
      await prisma.voiceBilling.create({
        data: {
          userId: session.userId,
          provider: session.provider,
          callId: session.id,
          cost: durationSec * 0.003, // $0.003 per second mock cost
          durationSeconds: durationSec
        }
      });

    } catch (err) {
      console.error('[VoiceTranscriptManager] processAndSummarizeSession error:', err.message);
    }
  }
}

module.exports = VoiceTranscriptManager;
