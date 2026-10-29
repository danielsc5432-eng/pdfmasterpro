import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export async function brandIcon(size: number) {
  const original = await readFile(path.join(process.cwd(), "public/brand/arquivelio-identidade.jpeg"));
  return new ImageResponse(
    <div style={{ display: "flex", position: "relative", width: size, height: size, background: "white", borderRadius: size * .18, overflow: "hidden" }}>
      <div style={{ display: "flex", position: "absolute", top: 0, left: 0, width: size, height: size, overflow: "hidden" }}>
        <img alt="" src={`data:image/jpeg;base64,${original.toString("base64")}`} width={size * 1536 / 200} height={size * 1024 / 200} style={{ position: "absolute", left: -size * 916 / 200, top: -size * 507 / 200 }} />
      </div>
    </div>,
    { width: size, height: size },
  );
}
