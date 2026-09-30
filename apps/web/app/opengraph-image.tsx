import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "W2O SALADA - 샐러드 새벽배송";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0A1A0F 0%, #1D9E75 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "24px" }}>
          <span style={{ fontSize: "72px", fontWeight: 900, color: "#ffffff" }}>W2O</span>
          <span style={{ fontSize: "36px", fontWeight: 400, color: "#5DCAA5", letterSpacing: "8px" }}>SALADA</span>
        </div>
        <div style={{ fontSize: "28px", color: "#EF9F27", fontWeight: 700, marginBottom: "16px" }}>
          일어나면 이미 준비된 하루
        </div>
        <div style={{ fontSize: "20px", color: "#5DCAA5", fontWeight: 400 }}>
          신선한 샐러드 새벽배송 · 정가 대비 상시 할인
        </div>
        <div
          style={{
            display: "flex",
            gap: "32px",
            marginTop: "40px",
            padding: "16px 40px",
            background: "rgba(255,255,255,0.1)",
            borderRadius: "16px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", color: "#fff" }}>
            <span style={{ fontSize: "32px", fontWeight: 900 }}>5,900원</span>
            <span style={{ fontSize: "14px", color: "#5DCAA5" }}>구독 단가</span>
          </div>
          <div style={{ width: "1px", background: "rgba(255,255,255,0.2)" }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", color: "#fff" }}>
            <span style={{ fontSize: "32px", fontWeight: 900 }}>주 2회</span>
            <span style={{ fontSize: "14px", color: "#5DCAA5" }}>새벽배송</span>
          </div>
          <div style={{ width: "1px", background: "rgba(255,255,255,0.2)" }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", color: "#fff" }}>
            <span style={{ fontSize: "32px", fontWeight: 900 }}>AM 6시</span>
            <span style={{ fontSize: "14px", color: "#5DCAA5" }}>도착 보장</span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
