import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { completeOrderPayment } from "../../lib/payment-complete";

const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY ?? "";

// GET: 워밍업 전용 (dev cold-compile 대비). /checkout 진입 시 프리페치되어
// 사용자가 Toss 결제 후 돌아왔을 때 POST 첫 호출이 즉시 응답하도록 함.
export async function GET() {
  return NextResponse.json({ ok: true });
}

// POST: 결제 승인 (토스페이먼츠 confirm)
export async function POST(request: Request) {
  try {
    const { paymentKey, orderId, amount } = await request.json();

    if (!paymentKey || !orderId || !amount) {
      return NextResponse.json({ error: "필수 파라미터가 누락되었습니다." }, { status: 400 });
    }

    if (!TOSS_SECRET_KEY) {
      return NextResponse.json({ error: "토스 시크릿 키가 설정되지 않았습니다." }, { status: 500 });
    }

    // ── 금액 위변조 검증 ──
    // 서버에 저장된 주문 금액과 클라이언트가 결제 요청한 금액이 일치해야 함
    try {
      const { prisma } = await import("@repo/db");
      const existing = await prisma.order.findUnique({
        where: { orderNo: orderId },
        select: { id: true, totalAmount: true, status: true, orderNo: true, paymentKey: true },
      });
      if (!existing) {
        return NextResponse.json({ error: "존재하지 않는 주문입니다." }, { status: 404 });
      }
      // 이미 PAID면 멱등(idempotent) 응답 — 재시도/새로고침 시 성공으로 취급
      if (existing.status === "PAID") {
        return NextResponse.json({
          success: true,
          alreadyPaid: true,
          order: { orderNo: existing.orderNo },
          payment: { paymentKey: existing.paymentKey, totalAmount: existing.totalAmount, status: "DONE" },
        });
      }
      if (existing.status !== "PENDING") {
        return NextResponse.json({ error: "이미 처리된 주문입니다." }, { status: 400 });
      }
      if (existing.totalAmount !== Number(amount)) {
        await prisma.order.update({
          where: { orderNo: orderId },
          data: { status: "FAILED" },
        });
        return NextResponse.json(
          {
            error: "결제 금액이 주문 금액과 일치하지 않습니다.",
            expected: existing.totalAmount,
            received: Number(amount),
          },
          { status: 400 },
        );
      }
    } catch (err) {
      console.error("주문 금액 검증 실패:", err);
      return NextResponse.json({ error: "주문 확인에 실패했습니다." }, { status: 500 });
    }

    // 토스페이먼츠 결제 승인 API 호출
    const tossResponse = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(TOSS_SECRET_KEY + ":").toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    const tossData = await tossResponse.json();

    if (!tossResponse.ok) {
      return NextResponse.json(
        { error: tossData.message ?? "결제 승인에 실패했습니다.", code: tossData.code },
        { status: 400 }
      );
    }

    // 결제 승인 성공 — DB 저장 시도 (실패해도 결제는 완료)
    try {
      await completeOrderPayment({ orderNo: orderId, amount: Number(amount), toss: tossData });
    } catch (err) {
      console.warn("DB 저장 실패 (결제는 승인됨):", orderId);
      // 결제는 외부에서 완료됐는데 DB 저장이 실패 — 매출/배송 장부 불일치 위험
      Sentry.captureException(err, {
        level: "error",
        tags: { area: "payment", phase: "post-confirm-db" },
        extra: { orderId, paymentKey: tossData.paymentKey },
      });
    }

    return NextResponse.json({
      success: true,
      order: { orderNo: orderId },
      payment: {
        paymentKey: tossData.paymentKey,
        method: tossData.method,
        totalAmount: tossData.totalAmount,
        status: tossData.status,
      },
    });
  } catch (err) {
    console.error("POST /api/payments error:", err);
    Sentry.captureException(err, {
      level: "error",
      tags: { area: "payment", phase: "confirm" },
    });
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
