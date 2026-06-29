# AI Agent Setup Guide

This guide explains how to configure and activate the workspace-aware Autonomous AI Agent on your WhatsApp Panel.

---

## 1. Choose AI Provider & Model

The panel supports multiple AI models. To select your provider:
1. Navigate to **AI Brain > Settings**.
2. Choose one of the integrated models:
   - **OpenAI**: Requires `aiApiKey` and uses `gpt-4o-mini` by default.
   - **Gemini**: Requires Google AI Studio API Key and uses `gemini-1.5-flash`.
   - **OpenRouter**: Useful for running custom open-source models (like Llama-3).
3. Paste your API Key and click **Save Settings**.

---

## 2. Customize System Prompts

The system prompt dictates the agent's behavior, tone, and language when conversing with customers.
- Go to the **AI Brain Prompt** section.
- Write a detailed persona:
  ```text
  You are an expert sales assistant for WaDesk Store.
  Be polite, respond in English, and keep answers concise (under 2 sentences).
  Help customers find order tracking links and checkout urls.
  ```

---

## 3. Upload Knowledge Base Documents

To let the AI answer specific queries about your business (FAQ, shipping times, refund policy):
1. Navigate to **AI Brain > Knowledge Base**.
2. Click **Upload Document**, choose a text or markdown file.
3. The system will parse and index the content.
4. When a user asks a question, the LLM passes the relevant context fragments dynamically, ensuring accurate, facts-based answers.

---

## 4. Enable AI Auto-Pilot

Once tested:
- Turn on the **AI Agent Active** toggle in settings.
- The system will now automatically reply to incoming WhatsApp messages using the AI prompt and knowledge documents.
- *Note: If a customer asks to speak to a human, the bot automatically pauses for 2 hours and alerts your team via the dashboard.*
