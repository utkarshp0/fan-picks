import { NextResponse, type NextRequest } from "next/server";

import {
  createPoolAgreementPdf,
  getPoolAgreement,
} from "@/lib/server-pool-agreement";

type RouteContext = {
  params: Promise<{ championshipId: string }>;
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { championshipId } = await params;
  const accessToken = request.headers
    .get("authorization")
    ?.replace("Bearer ", "");
  const result = await getPoolAgreement(accessToken ?? "", championshipId);

  if (!result.ok) {
    return NextResponse.json(result, { status: result.status });
  }

  if (request.nextUrl.searchParams.get("format") === "pdf") {
    const pdf = await createPoolAgreementPdf(result.agreement);
    const filename = `${result.agreement.agreementId.toLowerCase()}.pdf`;

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": "application/pdf",
      },
      status: 200,
    });
  }

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
    status: 200,
  });
}
