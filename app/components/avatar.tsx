import Image from "next/image";

// รูปโปรไฟล์ (ไม่มีรูป → โลโก้เว็บ)
export default function Avatar({
  url,
  alt,
  size,
  className = "",
}: {
  url: string | null | undefined;
  alt: string;
  size: number;
  className?: string;
}) {
  return (
    <Image
      src={url || "/images/logo.png"}
      alt={alt}
      width={size}
      height={size}
      className={`shrink-0 rounded-full object-cover ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
