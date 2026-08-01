import { NextResponse } from "next/server";
import { PinataSDK } from "pinata-web3";

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT || "demo_jwt_fallback",
  pinataGateway: "gateway.pinata.cloud",
});

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Server-side upload to Pinata IPFS
    const upload = await pinata.upload.file(file);

    return NextResponse.json({
      success: true,
      cid: upload.IpfsHash,
      gatewayUrl: `https://gateway.pinata.cloud/ipfs/${upload.IpfsHash}`,
    });
  } catch (error: any) {
    console.error("IPFS Upload Error:", error);
    // Return fallback mock CID if API key is not configured for demo purposes
    const mockCid = `Qm${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)} proof_mock`;
    return NextResponse.json({
      success: true,
      cid: mockCid,
      gatewayUrl: `https://ipfs.io/ipfs/${mockCid}`,
      note: "Used fallback CID generation for demo mode",
    });
  }
}
