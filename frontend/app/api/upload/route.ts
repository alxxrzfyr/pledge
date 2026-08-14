import { NextResponse } from "next/server";
import crypto from "crypto";

/**
 * Maximum accepted upload size (10 MB). Prevents unbounded memory usage from
 * arbitrarily large uploads being buffered in-process.
 */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const PINATA_JWT = process.env.PINATA_JWT || "";
const PINATA_GATEWAY = process.env.PINATA_GATEWAY_URL || "https://gateway.pinata.cloud";

/**
 * True IPFS pinning is only available when a Pinata JWT is configured.
 * Without it, the route runs in demo mode: it computes a local content hash
 * and returns it clearly labeled as unpinned, instead of fabricating a fake
 * IPFS CID that looks real but resolves nowhere.
 */
const IPFS_PINNING_ENABLED = Boolean(PINATA_JWT);

/**
 * Derive a demo-mode identifier for a file when no pinning provider is
 * configured. This is intentionally NOT a valid IPFS CID (no multibase
 * prefix resolution) so it can never be mistaken for real pinned content.
 */
function computeDemoHash(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export async function POST(request: Request) {
  let file: File | null = null;

  try {
    const formData = await request.formData();
    file = formData.get("file") as File | null;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid form data" }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ success: false, error: "File is empty" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { success: false, error: `File exceeds maximum size of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB` },
      { status: 413 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const mimeType = file.type || (file.name.endsWith(".pdf") ? "application/pdf" : "application/octet-stream");

  if (!IPFS_PINNING_ENABLED) {
    // Demo mode: no pinning provider configured. Be explicit about this
    // rather than fabricating a fake CID that looks like real IPFS content.
    const demoHash = computeDemoHash(buffer);
    const base64 = buffer.toString("base64");
    return NextResponse.json({
      success: true,
      demoMode: true,
      cid: null,
      demoHash,
      fileName: file.name,
      fileType: mimeType,
      dataUrl: base64.length < 7_000_000 ? `data:${mimeType};base64,${base64}` : null,
      warning:
        "IPFS pinning is not configured (PINATA_JWT missing). This evidence was NOT pinned to IPFS and exists only in this browser's local storage.",
    });
  }

  try {
    const { PinataSDK } = await import("pinata");
    const pinata = new PinataSDK({
      pinataJwt: PINATA_JWT,
      pinataGateway: PINATA_GATEWAY.replace(/^https?:\/\//, ""),
    });

    const uploadFile = new File([buffer], file.name || "evidence", { type: mimeType });
    const result = await pinata.upload.public.file(uploadFile);

    return NextResponse.json({
      success: true,
      demoMode: false,
      cid: result.cid,
      fileName: file.name,
      fileType: mimeType,
      gatewayUrl: `${PINATA_GATEWAY}/ipfs/${result.cid}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown IPFS pinning error";
    console.error("Pinata upload failed:", message);
    return NextResponse.json(
      { success: false, error: `Failed to pin evidence to IPFS: ${message}` },
      { status: 502 }
    );
  }
}
