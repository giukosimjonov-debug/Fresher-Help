import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ELEVENLABS_API_KEY is not configured." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const rawText: string = (body.text || "").trim();
    if (!rawText) {
      return NextResponse.json({ error: "Text is required." }, { status: 400 });
    }

    // Bepul tokenlarni tejash uchun matnni 1200 belgigacha qisqartiramiz
    const text = rawText.slice(0, 1200);
    const voiceId = "21m00Tcm4TlvDq8ikWAM"; // Rachel (clear, natural voice)

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_flash_v2_5",
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `ElevenLabs API error (${response.status}): ${errText}` },
        { status: response.status }
      );
    }

    const audioBuffer = await response.arrayBuffer();
    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to generate speech";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
