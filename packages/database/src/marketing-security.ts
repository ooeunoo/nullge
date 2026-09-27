import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { StoreError } from "./store";
export const encryptionReady = () =>
  /^[a-f0-9]{64}$/i.test(process.env.MARKETING_SECRET_KEY || "");
function key() {
  if (!encryptionReady())
    throw new StoreError(503, "서버 암호화 키 설정이 필요합니다.");
  return Buffer.from(process.env.MARKETING_SECRET_KEY!, "hex");
}
export function seal(value: unknown, context: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(`nullge-marketing-v1:${context}`));
  const bytes = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    bytes.toString("base64url"),
  ].join(".");
}
export function unseal<T>(value: string | null, context: string): T {
  if (!value) return {} as T;
  try {
    const [v, iv, tag, bytes] = value.split(".");
    if (v !== "v1") throw Error();
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key(),
      Buffer.from(iv!, "base64url"),
    );
    decipher.setAAD(Buffer.from(`nullge-marketing-v1:${context}`));
    decipher.setAuthTag(Buffer.from(tag!, "base64url"));
    return JSON.parse(
      Buffer.concat([
        decipher.update(Buffer.from(bytes!, "base64url")),
        decipher.final(),
      ]).toString("utf8"),
    );
  } catch {
    throw new StoreError(
      503,
      "저장된 연결 정보를 복호화하지 못했습니다. 서버 암호화 키를 확인해 주세요.",
    );
  }
}
export function referenceImage(value?: string) {
  if (!value) return;
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
    value,
  );
  if (!match)
    throw new StoreError(400, "참고 이미지는 JPEG 또는 PNG만 지원합니다.");
  const bytes = Buffer.from(match[2]!, "base64");
  if (
    bytes.length > 2 * 1024 * 1024 ||
    mediaMime(bytes) !== `image/${match[1]}`
  )
    throw new StoreError(
      400,
      "참고 이미지는 올바른 2 MB 이하 파일이어야 합니다.",
    );
}
export function mediaMime(bytes: Buffer) {
  if (bytes.length < 12)
    throw new StoreError(400, "미디어 파일을 확인할 수 없습니다.");
  if (bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])))
    return "image/jpeg";
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (bytes.subarray(4, 8).toString() === "ftyp") return "video/mp4";
  throw new StoreError(400, "JPEG, PNG, MP4만 지원합니다.");
}
function publicAddress(ip: string) {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a! >= 224 ||
      (a === 100 && b! >= 64 && b! <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b! >= 16 && b! <= 31) ||
      (a === 192 && [0, 168].includes(b!)) ||
      (a === 198 && [18, 19, 51].includes(b!)) ||
      (a === 203 && b === 0)
    );
  }
  return (
    /^[23]/.test(ip) && !ip.startsWith("2001:db8:") && !ip.startsWith("2002:")
  );
}
export async function downloadMedia(value: string) {
  // Exact CDN host allowlist; no arbitrary project/user URLs are fetched by the server.
  const hosts = (process.env.HIGGSFIELD_MEDIA_HOSTS || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  let url = new URL(value);
  for (let hop = 0; hop < 4; hop++) {
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !hosts.includes(url.hostname) ||
      isIP(url.hostname)
    )
      throw new StoreError(
        400,
        `생성 미디어 CDN 호스트 ${url.hostname}을(를) 서버 HIGGSFIELD_MEDIA_HOSTS 허용 목록에 등록해 주세요.`,
      );
    const addresses = await lookup(url.hostname, { all: true });
    if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
      throw new StoreError(400, "미디어 주소가 허용되지 않습니다.");
    const r = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(45000),
    });
    if ([301, 302, 303, 307, 308].includes(r.status)) {
      await r.body?.cancel();
      url = new URL(r.headers.get("location") || "", url);
      continue;
    }
    if (!r.ok || !r.body)
      throw new StoreError(502, "생성 미디어를 다운로드하지 못했습니다.");
    const reader = r.body.getReader(),
      parts: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 25 * 1024 * 1024) {
        await reader.cancel();
        throw new StoreError(400, "생성 미디어가 25 MB를 초과합니다.");
      }
      parts.push(value);
    }
    const content = Buffer.concat(parts);
    return { content, mime: mediaMime(content) };
  }
  throw new StoreError(502, "미디어 리디렉션이 너무 많습니다.");
}
