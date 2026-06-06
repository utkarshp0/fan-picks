import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export function GET(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get("kind") === "match" ? "match" : "pool";
  const isMatch = kind === "match";
  const title = isMatch ? "Join a Match Pick" : "Join a Fan Picks pool";
  const subtitle = isMatch
    ? "One fixture. One question. Picks lock before kickoff."
    : "Make picks with friends. Lock before the tournament starts.";
  const pill = isMatch ? "Match Picks" : "Prediction Pool";

  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "stretch",
          background: "#08090b",
          color: "#f8fafc",
          display: "flex",
          height: "100%",
          padding: 54,
          width: "100%",
        }}
      >
        <div
          style={{
            background: "#12161d",
            border: "2px solid #26303d",
            borderRadius: 28,
            display: "flex",
            flexDirection: "column",
            height: "100%",
            justifyContent: "space-between",
            overflow: "hidden",
            padding: 46,
            position: "relative",
            width: "100%",
          }}
        >
          <div
            style={{
              background: "#18c37e",
              height: 12,
              left: 46,
              position: "absolute",
              right: 46,
              top: 0,
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div style={{ alignItems: "center", display: "flex", gap: 18 }}>
              <div
                style={{
                  alignItems: "center",
                  background: "#18c37e",
                  borderRadius: 18,
                  display: "flex",
                  height: 76,
                  justifyContent: "center",
                  position: "relative",
                  width: 76,
                }}
              >
                <div
                  style={{
                    background: "#07110d",
                    borderRadius: 8,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    height: 52,
                    justifyContent: "center",
                    padding: "0 12px",
                    width: 40,
                  }}
                >
                  <div style={{ background: "#f8fafc", borderRadius: 6, height: 5, width: 28 }} />
                  <div style={{ background: "#f8fafc", borderRadius: 6, height: 5, width: 18 }} />
                  <div
                    style={{
                      color: "#18c37e",
                      fontSize: 28,
                      fontWeight: 900,
                      lineHeight: 1,
                      marginTop: -2,
                    }}
                  >
                    ✓
                  </div>
                </div>
                <div
                  style={{
                    background: "#f8fafc",
                    borderRadius: 999,
                    height: 8,
                    left: 14,
                    position: "absolute",
                    top: 13,
                    width: 8,
                  }}
                />
                <div
                  style={{
                    background: "#f8fafc",
                    borderRadius: 999,
                    bottom: 13,
                    height: 8,
                    position: "absolute",
                    right: 14,
                    width: 8,
                  }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 34, fontWeight: 800 }}>Fan Picks</div>
                <div style={{ color: "#b9c6d6", fontSize: 21 }}>Back your opinions</div>
              </div>
            </div>
            <div
              style={{
                alignItems: "center",
                background: "rgba(24, 195, 126, 0.12)",
                border: "2px solid rgba(24, 195, 126, 0.45)",
                borderRadius: 999,
                color: "#18c37e",
                display: "flex",
                fontSize: 24,
                fontWeight: 800,
                height: 54,
                padding: "0 24px",
              }}
            >
              {pill}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ color: "#18c37e", fontSize: 26, fontWeight: 800 }}>
              Invite link
            </div>
            <div
              style={{
                fontSize: 76,
                fontWeight: 900,
                letterSpacing: 0,
                lineHeight: 1.03,
                maxWidth: 880,
              }}
            >
              {title}
            </div>
            <div
              style={{
                color: "#c7d2e1",
                fontSize: 32,
                lineHeight: 1.32,
                maxWidth: 840,
              }}
            >
              {subtitle}
            </div>
          </div>

          <div
            style={{
              alignItems: "center",
              background: "#090b0f",
              border: "2px solid #26303d",
              borderRadius: 20,
              color: "#dbe6f3",
              display: "flex",
              fontSize: 25,
              fontWeight: 700,
              justifyContent: "space-between",
              padding: "24px 28px",
            }}
          >
            <span>No money. No odds. Just picks and receipts.</span>
            <span style={{ color: "#18c37e" }}>fan-picks.vercel.app</span>
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
