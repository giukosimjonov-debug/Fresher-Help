import { NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs";
import path from "path";

function cleanPlainText(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\|[-:\s|]+\|$/gm, "")
    .replace(/^\|\s*(.*?)\s*\|$/gm, (_, row: string) =>
      row
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean)
        .join(" — ")
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GROQ_API_KEY topilmadi. .env.local faylini tekshiring." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const userMessage: string = body.message || "";

    let compactKnowledge = "University of Debrecen & DKV transit assistant.";
    try {
      const filePath = path.join(process.cwd(), "data", "debrecen.json");
      const parsedJson = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      // Katta hajmli directory ro'yxatini AI promptidan chiqarib tashlaymiz (413 xatosini oldini olish uchun)
      const { directory, ...coreData } = parsedJson;
      void directory;
      compactKnowledge = JSON.stringify(coreData).slice(0, 6000);
    } catch {
      // Fallback
    }

    const client = new OpenAI({
      baseURL: "https://api.groq.com/openai/v1",
      apiKey,
      timeout: 12000,
      maxRetries: 1,
    });

    // 8000 TPM cheklovi bor 120b modeldan qochib, tezkor modelni tanlaymiz
    let selectedModel = "llama-3.1-8b-instant";
    try {
      const modelsPage = await client.models.list();
      const chatModels = modelsPage.data
        .map((m) => m.id)
        .filter(
          (id) =>
            !/whisper|tts|guard|orpheus|playai|embed|120b|compound/i.test(id)
        );

      const preferred =
        chatModels.find((id) => /llama-3\.1-8b|llama-4|qwen|gemma/i.test(id)) ||
        chatModels[0];

      if (preferred) {
        selectedModel = preferred;
      }
    } catch {
      // Default model
    }

    const response = await client.chat.completions.create({
      model: selectedModel,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `You are "Fresher Help", a friendly AI campus assistant for University of Debrecen students.
Use this local Debrecen knowledge base:
${compactKnowledge}

CRITICAL FORMATTING RULE:
Output plain text only. NEVER use Markdown bold (**), asterisks (*), Markdown tables (|---|), hashtags (#), or HTML tags like <br>. Use clean numbered lines (1., 2., 3.) or bullet points (•).

TOOL USE RULE:
Whenever the user pastes a Hungarian email/letter, asks for a document checklist, or mentions an appointment/class/deadline with a specific day or time, ALWAYS call the "add_tasks" function to add actionable steps to their Action Plan AND provide a clear English explanation in "reply_message".`,
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "add_tasks",
            description:
              "Create actionable student tasks/checklists/reminders and provide the full plain-text explanation.",
            parameters: {
              type: "object",
              properties: {
                reply_message: {
                  type: "string",
                  description:
                    "Clean plain-text English translation, route steps, or explanation without any Markdown symbols.",
                },
                tasks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      deadline: { type: "string" },
                      category: {
                        type: "string",
                        enum: ["Admin", "Transport", "Academic"],
                      },
                    },
                    required: ["title", "deadline", "category"],
                  },
                },
              },
              required: ["reply_message", "tasks"],
            },
          },
        },
      ],
      tool_choice: "auto",
    });

    const choice = response.choices[0]?.message;
    const toolCall = choice?.tool_calls?.[0];

    if (toolCall && "function" in toolCall) {
      const parsed = JSON.parse(toolCall.function.arguments);
      return NextResponse.json({
        reply: cleanPlainText(
          parsed.reply_message ||
            choice?.content ||
            "Tasks added to your Action Plan!"
        ),
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      });
    }

    return NextResponse.json({
      reply: cleanPlainText(
        choice?.content || "How can I help you in Debrecen today?"
      ),
      tasks: [],
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown backend error";
    console.error("Chat API Error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
