// หาจุดโครงกระดูกในเบราว์เซอร์ (MediaPipe Tasks) — ใช้ "วาด" อย่างเดียว ไม่มี delay จากเครือข่าย
// การประเมินท่ายังทำบน AI server เหมือนเดิม (Holistic ตัวเดียวกับตอนอัด dataset)
import type { Landmarks } from "./salute-ai";

const TASKS_VERSION = "1.0.1"; // ต้องตรงกับ @mediapipe/tasks-vision ใน package.json
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VERSION}/wasm`;
const POSE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const HAND_MODEL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export interface LocalLandmarker {
  detect(video: HTMLVideoElement, timestamp: number): Landmarks;
  close(): void;
}

export async function createLocalLandmarker(): Promise<LocalLandmarker> {
  const { FilesetResolver, PoseLandmarker, HandLandmarker } = await import("@mediapipe/tasks-vision");
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL);

  const create = async (delegate: "GPU" | "CPU") =>
    Promise.all([
      PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: POSE_MODEL, delegate },
        runningMode: "VIDEO",
        numPoses: 1,
      }),
      HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: HAND_MODEL, delegate },
        runningMode: "VIDEO",
        numHands: 2,
      }),
    ]);

  // GPU เร็วกว่ามาก แต่บางเครื่อง/เบราว์เซอร์ไม่รองรับ → ถอยไปใช้ CPU
  const [pose, hands] = await create("GPU").catch(() => create("CPU"));

  // วิดีโอแสดงแบบกระจก + เซิร์ฟเวอร์ส่งพิกัดของภาพที่ flip แล้ว → กลับแกน x ให้ตรงกัน
  const mirror = (x: number) => Math.round((1 - x) * 10000) / 10000;

  return {
    detect(video, timestamp) {
      const body = pose.detectForVideo(video, timestamp).landmarks[0];
      const found = hands.detectForVideo(video, timestamp).landmarks;

      return {
        pose: body ? body.map((p) => [mirror(p.x), p.y, p.visibility ?? 1] as [number, number, number]) : null,
        left_hand: found[0] ? found[0].map((p) => [mirror(p.x), p.y] as [number, number]) : null,
        right_hand: found[1] ? found[1].map((p) => [mirror(p.x), p.y] as [number, number]) : null,
      };
    },
    close() {
      pose.close();
      hands.close();
    },
  };
}
