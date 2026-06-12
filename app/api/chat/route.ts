import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `당신은 친절한 한국어 회화 선생님입니다.

학생이 한 말에 대해 반드시 아래 JSON 형식으로만 응답하세요. JSON 외의 텍스트는 절대 출력하지 마세요.

{
  "correction": "학생의 문장에 문법/표현 오류가 있으면 무엇이 왜 틀렸는지 간단히 설명. 오류가 없으면 null",
  "natural": "같은 내용을 한국 사람이 실제로 말하는 자연스러운 표현으로 다시 쓴 문장. 학생 문장이 이미 완벽하면 null",
  "reply": "대화를 자연스럽게 이어가는 응답. 2-3문장 이내. 질문을 했으면 학생의 대답을 기다리고 스스로 대답하지 않기"
}

규칙:
1. reply는 기본적으로 한국어로만. 단, 학생이 명시적으로 영어나 중국어로 설명해 달라고 요청하면 (예: 한자 표기, 단어 뜻) 그 부분만 요청한 언어로 설명하고 다시 한국어로 돌아가세요.
2. correction과 natural의 설명 부분은 한국어로 쓰되, 학생 수준에 맞게 쉽게.
3. 학생 수준에 맞는 어휘 사용.`;

export async function POST(req: NextRequest) {
  const { messages } = await req.json();

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ],
    response_format: { type: "json_object" },
  });

  const parsed = JSON.parse(completion.choices[0].message.content || "{}");

  return NextResponse.json({
    correction: parsed.correction ?? null,
    natural: parsed.natural ?? null,
    reply: parsed.reply ?? "",
  });
}