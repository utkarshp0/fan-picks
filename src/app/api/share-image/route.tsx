import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export function GET(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get("kind") === "match" ? "match" : "pool";
  const inviteCode = request.nextUrl.searchParams.get("code")?.trim().toUpperCase();
  const isMatch = kind === "match";
  const title = isMatch ? "Join this Match Pick" : "Join this Fan Picks Pool";
  const subtitle = isMatch
    ? "One match. One question. Lock your pick before kickoff."
    : "Pick your winners with friends. Lock the receipts before the tournament starts.";
  const tag = isMatch ? "MATCH PICKS" : "FRIENDS POOL";
  const action = isMatch ? "Predict the match" : "Make your tournament picks";
  const codeLabel = inviteCode || (isMatch ? "MATCH ROOM" : "INVITE CODE");

  return new ImageResponse(
    (
      <div
        style={{
          background:
            "linear-gradient(135deg, #07100d 0%, #0a0d14 42%, #101827 100%)",
          color: "#f8fafc",
          display: "flex",
          height: "100%",
          padding: 42,
          width: "100%",
        }}
      >
        <div
          style={{
            background:
              "linear-gradient(135deg, rgba(24,195,126,0.18), rgba(8,9,11,0.94) 42%, rgba(25,34,49,0.96))",
            border: "2px solid rgba(255,255,255,0.14)",
            borderRadius: 34,
            display: "flex",
            height: "100%",
            overflow: "hidden",
            position: "relative",
            width: "100%",
          }}
        >
          <div
            style={{
              border: "2px solid rgba(24,195,126,0.26)",
              borderRadius: 999,
              height: 520,
              left: -150,
              position: "absolute",
              top: 70,
              width: 520,
            }}
          />
          <div
            style={{
              border: "2px solid rgba(255,255,255,0.11)",
              borderRadius: 999,
              bottom: -210,
              height: 520,
              position: "absolute",
              right: -120,
              width: 520,
            }}
          />
          <div
            style={{
              background: "rgba(255,255,255,0.05)",
              bottom: 64,
              height: 2,
              left: 64,
              position: "absolute",
              right: 64,
            }}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: 56,
              width: "65%",
            }}
          >
            <div style={{ alignItems: "center", display: "flex", gap: 18 }}>
              <div
                style={{
                  alignItems: "center",
                  background: "#18c37e",
                  borderRadius: 18,
                  color: "#06110c",
                  display: "flex",
                  fontSize: 42,
                  fontWeight: 900,
                  height: 72,
                  justifyContent: "center",
                  width: 72,
                }}
              >
                FP
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ fontSize: 34, fontWeight: 900 }}>Fan Picks</div>
                <div style={{ color: "#b7c5d8", fontSize: 21 }}>
                  Friendly prediction rooms
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div
                style={{
                  alignItems: "center",
                  background: "rgba(24,195,126,0.13)",
                  border: "2px solid rgba(24,195,126,0.38)",
                  borderRadius: 999,
                  color: "#38f2a6",
                  display: "flex",
                  fontSize: 24,
                  fontWeight: 900,
                  justifyContent: "center",
                  letterSpacing: 2,
                  padding: "12px 22px",
                  width: 220,
                }}
              >
                {tag}
              </div>
              <div
                style={{
                  fontSize: 76,
                  fontWeight: 950,
                  letterSpacing: 0,
                  lineHeight: 0.98,
                }}
              >
                {title}
              </div>
              <div
                style={{
                  color: "#d6e1ef",
                  fontSize: 31,
                  lineHeight: 1.25,
                  maxWidth: 690,
                }}
              >
                {subtitle}
              </div>
            </div>

            <div
              style={{
                alignItems: "center",
                color: "#aebbd0",
                display: "flex",
                fontSize: 23,
                fontWeight: 700,
                gap: 18,
              }}
            >
              <span>No money</span>
              <span style={{ color: "#18c37e" }}>•</span>
              <span>No odds</span>
              <span style={{ color: "#18c37e" }}>•</span>
              <span>Just receipts</span>
            </div>
          </div>

          <div
            style={{
              alignItems: "center",
              display: "flex",
              justifyContent: "center",
              padding: "44px 50px 44px 0",
              width: "35%",
            }}
          >
            <div
              style={{
                background: "#f8fafc",
                borderRadius: 30,
                boxShadow: "0 30px 80px rgba(0,0,0,0.38)",
                color: "#07100d",
                display: "flex",
                flexDirection: "column",
                gap: 28,
                height: 448,
                justifyContent: "space-between",
                padding: 30,
                transform: "rotate(2deg)",
                width: 300,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div
                  style={{
                    color: "#64748b",
                    fontSize: 17,
                    fontWeight: 900,
                    letterSpacing: 2,
                  }}
                >
                  INVITE
                </div>
                <div
                  style={{
                    background: "#07100d",
                    borderRadius: 18,
                    color: "#38f2a6",
                    display: "flex",
                    fontSize: inviteCode ? 31 : 23,
                    fontWeight: 950,
                    justifyContent: "center",
                    padding: "22px 14px",
                  }}
                >
                  {codeLabel}
                </div>
              </div>
              <div
                style={{
                  background: "#e7f8ef",
                  border: "2px solid #b7efd1",
                  borderRadius: 22,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  padding: 22,
                }}
              >
                <div style={{ color: "#0f5132", fontSize: 19, fontWeight: 900 }}>
                  {action}
                </div>
                <div style={{ color: "#355948", fontSize: 17, lineHeight: 1.25 }}>
                  Open the link, log in, and join in seconds.
                </div>
              </div>
              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  gap: 10,
                  justifyContent: "space-between",
                }}
              >
                <div style={{ color: "#64748b", fontSize: 16, fontWeight: 800 }}>
                  fan-picks.vercel.app
                </div>
                <div
                  style={{
                    alignItems: "center",
                    background: "#18c37e",
                    borderRadius: 999,
                    color: "#07100d",
                    display: "flex",
                    fontSize: 20,
                    fontWeight: 950,
                    height: 42,
                    justifyContent: "center",
                    width: 42,
                  }}
                >
                  →
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      height: 630,
      width: 1200,
    },
  );
}
