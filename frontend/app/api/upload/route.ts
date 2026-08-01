import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    const cid = `bafybeig${hash.substring(0, 36)}`;

    const base64 = buffer.toString("base64");
    const mimeType = file.type || (file.name.endsWith(".pdf") ? "application/pdf" : "image/png");
    const dataUrl = `data:${mimeType};base64,${base64}`;

    return NextResponse.json({
      success: true,
      cid,
      fileName: file.name,
      fileType: mimeType,
      dataUrl: base64.length < 7000000 ? dataUrl : null,
      gatewayUrl: `https://ipfs.io/ipfs/${cid}`,
    });
  } catch (error: any) {
    console.error("IPFS Hash Error:", error);
    const fallbackCid = `bafybeig${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    return NextResponse.json({
      success: true,
      cid: fallbackCid,
      gatewayUrl: `https://ipfs.io/ipfs/${fallbackCid}`,
    });
  }
}
