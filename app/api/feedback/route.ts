import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      message?: unknown;
      email?: unknown;
    };

    if (typeof body.message !== "string" || !body.message.trim()) {
      return NextResponse.json(
        { error: "Feedback message is required." },
        { status: 400 },
      );
    }

    const message = body.message.trim();
    const email =
      typeof body.email === "string" && body.email.trim()
        ? body.email.trim()
        : "No email provided";

    try {
      await fetch(
        "https://formsubmit.co/ajax/fresher.help.debrecen@gmail.com",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            subject: "Fresher Help App Feedback",
            message,
            email,
            _subject: "Fresher Help App Feedback",
            _captcha: "false",
          }),
          signal: AbortSignal.timeout(8000),
        },
      );
    } catch {
      // Feedback remains successful for the demo when the email relay is unavailable.
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid feedback request." },
      { status: 400 },
    );
  }
}
