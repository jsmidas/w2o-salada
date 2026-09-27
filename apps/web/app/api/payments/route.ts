import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { completeOrderPayment } from "../../lib/payment-complete";
import { groupState, loadPaymentGroup } from "../../lib/payment-group";

const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY ?? "";

// GET: 워밍업 전용 (dev cold-compile 대비). /checkout 진입 시 프리페치되어
// 사용자가 Toss 결제 후 돌아왔을 때 POST 첫 호출이 즉시 응답하도록 함.
export async function GET() {
  return NextResponse.json({ ok: true });
}

/**
 * POST: 결제 승인 (토스페이먼츠 confirm)
 * body.orderId 는 Order.id · orderNo · paymentGroupNo 중 무엇이든 받는다 (successUrl 이 우리 id 와 토스 orderId 를 둘 다 실어 온다).
 * 배송일이 다른 주문 N건을 묶어 결제한 경우 합계 금액으로 검증하고, 승인 뒤 주문마다 PAID 처리한다.
 */
export async function POST(request: Request) {
  try {
    const { paymentKey, orderId, amount } = await request.json();
    const { lookupDonePayment } = await import("../../lib/toss-lookup");

    if (!paymentKey || !orderId || !amount) {
      return NextResponse.json({ error: "필수 파라미터가 누락되었습니다." }, { status: 400 });
    }

    if (!TOSS_SECRET_KEY) {
      return NextResponse.json({ error: "토스 시크릿 키가 설정되지 않았습니다." }, { status: 500 });
    }

    // ── 금액 위변조 검증 — 서버에 저장된 주문(묶음) 금액과 일치해야 한다 ──
    let group;
    try {
      group = await loadPaymentGroup(String(orderId));
      if (!group) {
        return NextResponse.json({ error: "존재하지 않는 주문입니다." }, { status: 404 });
      }
      const state = groupState(group.orders);
      // 이미 PAID면 멱등(idempotent) 응답 — 재시도/새로고침 시 성공으로 취급
      if (state === "PAID") {
        const first = group.orders[0]!;
        return NextResponse.json({
          success: true,
          alreadyPaid: true,
          order: { orderNo: first.orderNo, orderNos: group.orders.map((o) => o.orderNo) },
          payment: { paymentKey: first.paymentKey, totalAmount: group.totalAmount, status: "DONE" },
        });
      }
      if (state !== "PENDING") {
        return NextResponse.json({ error: "이미 처리된 주문입니다." }, { status: 400 });
      }
      if (group.totalAmount !== Number(amount)) {
        // 주문은 PENDING 으로 남겨 다시 결제할 수 있게 한다 (예전엔 FAILED 로 죽여 재주문이 필요했다)
        return NextResponse.json(
          { error: "결제 금액이 주문 금액과 일치하지 않습니다.", expected: group.totalAmount, received: Number(amount) },
          { status: 400 },
        );
      }
    } catch (err) {
      console.error("주문 금액 검증 실패:", err);
      return NextResponse.json({ error: "주문 확인에 실패했습니다." }, { status: 500 });
    }

    // 토스페이먼츠 결제 승인 API 호출 — orderId 는 결제창을 열 때 쓴 값(그룹번호 또는 주문번호)
    const tossResponse = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(TOSS_SECRET_KEY + ":").toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ paymentKey, orderId: group.paymentOrderId, amount }),
    });

    let tossData = await tossResponse.json();

    if (!tossResponse.ok) {
      // 이미 승인된 결제(두 탭·재시도) — 토스에서 조회해 우리 주문과 맞으면 그 결과로 마무리한다. 예전엔 여기서 영원히 "승인 실패" 였다
      const recovered = tossData.code === "ALREADY_PROCESSED_PAYMENT" ? await lookupDonePayment(paymentKey, group.paymentOrderId, Number(amount)) : null;
      if (!recovered) {
        return NextResponse.json(
          { error: tossData.message ?? "결제 승인에 실패했습니다.", code: tossData.code },
          { status: 400 }
        );
      }
      tossData = recovered;
    }

    // 결제 승인 성공 — 묶음의 주문마다 PAID 처리 (실패해도 결제는 완료)
    for (const o of group.orders) {
      try {
        await completeOrderPayment({ orderNo: o.orderNo, amount: o.totalAmount, toss: tossData });
      } catch (err) {
        console.warn("DB 저장 실패 (결제는 승인됨):", o.orderNo);
        // 결제는 외부에서 완료됐는데 DB 저장이 실패 — 매출/배송 장부 불일치 위험
        Sentry.captureException(err, {
          level: "error",
          tags: { area: "payment", phase: "post-confirm-db" },
          extra: { orderNo: o.orderNo, paymentOrderId: group.paymentOrderId, paymentKey: tossData.paymentKey },
        });
      }
    }

    return NextResponse.json({
      success: true,
      order: { orderNo: group.orders[0]!.orderNo, orderNos: group.orders.map((o) => o.orderNo) },
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
