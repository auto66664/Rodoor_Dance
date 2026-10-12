// รูปโปรไฟล์ → Supabase Storage (bucket "avatars") + profiles.avatar_url
import { createClient } from "./supabase/client";

const BUCKET = "avatars";
const SIZE = 512; // ย่อเป็นสี่เหลี่ยมจัตุรัส 512×512 ก่อนอัปโหลด
const MAX_INPUT_BYTES = 10 * 1024 * 1024; // ไฟล์ต้นฉบับไม่เกิน 10 MB (หลังย่อเหลือไม่กี่ร้อย KB)
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

export const AVATAR_ACCEPT = ACCEPTED.join(",");

/** ครอปกลางภาพให้เป็นสี่เหลี่ยมจัตุรัส แล้วย่อเป็น JPEG */
async function toSquareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("เบราว์เซอร์นี้ย่อรูปไม่ได้");

  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("แปลงรูปไม่สำเร็จ"))), "image/jpeg", 0.88)
  );
}

/** อัปโหลดรูปใหม่ แล้วบันทึกลิงก์ลงโปรไฟล์ → คืนลิงก์รูป */
export async function uploadAvatar(userId: string, file: File) {
  if (!ACCEPTED.includes(file.type)) throw new Error("รองรับเฉพาะไฟล์ JPG, PNG หรือ WEBP");
  if (file.size > MAX_INPUT_BYTES) throw new Error("ไฟล์ใหญ่เกิน 10 MB");

  const supabase = createClient();
  const path = `${userId}/avatar.jpg`;
  const blob = await toSquareJpeg(file);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: true, cacheControl: "3600" });
  if (uploadError) throw new Error(uploadError.message);

  // ใส่ ?v= ให้เบราว์เซอร์โหลดรูปใหม่ (ชื่อไฟล์เดิม)
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const url = `${data.publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
  if (updateError) throw new Error(updateError.message);

  return url;
}

/** ลบรูป → กลับไปใช้รูปเริ่มต้น */
export async function removeAvatar(userId: string) {
  const supabase = createClient();
  await supabase.storage.from(BUCKET).remove([`${userId}/avatar.jpg`]);

  const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId);
  if (error) throw new Error(error.message);
}
