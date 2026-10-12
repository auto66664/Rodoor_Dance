// การเชื่อมต่อกับ SaluteAI Web API (AI_Detection/web_api) — รูปแบบข้อความดู AI_Detection/web_api/README.md

export const SALUTE_AI_URL = process.env.NEXT_PUBLIC_SALUTE_AI_URL ?? "http://127.0.0.1:8000";

export type SessionMode = "training" | "test";

export function socketUrl(mode: SessionMode) {
  return `${SALUTE_AI_URL.replace(/^http/, "ws")}/ws/${mode}`;
}

export interface Framing {
  body: boolean;
  head: boolean;
  feet: boolean;
}

export interface Landmarks {
  pose: [number, number, number][] | null;
  left_hand: [number, number][] | null;
  right_hand: [number, number][] | null;
}

export interface FeedbackItem {
  code: string;
  name: string;
  tip: string;
}

// ---------- โหมดฝึก ----------
export interface TrainingResult {
  status: "passed" | "correct" | "fix" | "not_similar";
  message: string;
  similarity: number;
  distance: number;
  is_similar: boolean;
  errors: FeedbackItem[];
}

// ---------- โหมดทดสอบ ----------
export interface Deduction {
  reason: string;
  amount: number;
}

export interface AttemptResult {
  attempt: number;
  accuracy: number;
  passed: boolean;
  similarity: number;
  is_similar: boolean;
  rules_passed: number;
  total_rules: number;
  penalty: number;
  deductions: Deduction[];
  errors: FeedbackItem[];
  body_visible: boolean;
  saved_as_correct?: string;
}

export interface TestSummary {
  overall_accuracy: number;
  best: number;
  worst: number;
  passed: number;
  attempts: number;
  common_errors: (FeedbackItem & { count: number })[];
}

export type TestState = "idle" | "countdown" | "waiting" | "recording" | "result" | "summary";

// ข้อความจากเซิร์ฟเวอร์ (frame = ตอบภาพ, state = ตอบคำสั่ง)
export interface ServerMessage {
  type: "hello" | "frame" | "state" | "error";
  mode?: SessionMode;
  message?: string | null;
  framing?: Framing;
  landmarks?: Landmarks;
  state?: string;

  // training
  buffer_seconds?: number;
  result?: TrainingResult | AttemptResult | null;

  // test
  attempt?: number;
  num_attempts?: number;
  ready?: boolean;
  countdown?: number;
  wait_remaining?: number;
  elapsed?: number;
  duration?: number;
  can_save_correct?: boolean;
  summary?: TestSummary | null;
  results?: AttemptResult[];
  saved_file?: string | null;
}

export type Command =
  | { type: "start"; num_attempts?: number }
  | { type: "next" }
  | { type: "save_correct" }
  | { type: "stop" }
  | { type: "reset" };

export interface Connections {
  pose: [number, number][];
  hand: [number, number][];
}

// วาดโครงกระดูกบน canvas ที่ซ้อนวิดีโอแบบ object-cover (เต็มจอ ภาพถูกครอปให้พอดีจอ)
// พิกัด 0–1 เป็นของภาพที่ flip แล้ว = ตรงกับวิดีโอที่แสดงแบบกระจก
export function drawSkeleton(
  canvas: HTMLCanvasElement,
  landmarks: Landmarks | undefined,
  connections: Connections | null,
  sourceWidth: number,
  sourceHeight: number
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);

  if (!landmarks || !connections || !sourceWidth || !sourceHeight) return;

  // object-cover: ขยายให้เต็ม แล้วครอปส่วนเกินตรงกลาง
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const offsetX = (width - sourceWidth * scale) / 2;
  const offsetY = (height - sourceHeight * scale) / 2;
  const toX = (x: number) => offsetX + x * sourceWidth * scale;
  const toY = (y: number) => offsetY + y * sourceHeight * scale;

  const drawSet = (points: [number, number, ...number[]][] | null, edges: [number, number][], line: string, dot: string) => {
    if (!points) return;

    ctx.strokeStyle = line;
    ctx.lineWidth = 4;
    for (const [a, b] of edges) {
      const p = points[a];
      const q = points[b];
      if (!p || !q) continue;
      ctx.beginPath();
      ctx.moveTo(toX(p[0]), toY(p[1]));
      ctx.lineTo(toX(q[0]), toY(q[1]));
      ctx.stroke();
    }

    ctx.fillStyle = dot;
    for (const p of points) {
      ctx.beginPath();
      ctx.arc(toX(p[0]), toY(p[1]), 5, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  drawSet(landmarks.pose, connections.pose, "rgba(255,255,255,0.75)", "#ffd22e");
  drawSet(landmarks.left_hand, connections.hand, "rgba(77,180,255,0.9)", "#4db4ff");
  drawSet(landmarks.right_hand, connections.hand, "rgba(255,120,200,0.9)", "#ff78c8");
}
