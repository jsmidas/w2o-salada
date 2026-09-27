import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = {
  productId: string;
  name: string;
  price: number;
  imageUrl: string | null;
  quantity: number;
  // 배송일이 지정된 경우 (Weekly 식단에서 담은 경우)
  // 같은 상품이라도 배송일이 다르면 별개 라인으로 취급됨.
  // null/undefined = 배송일 미지정 (상품 상세 등에서 담은 경우, 다음 가능한 배송에 포함)
  deliveryDate?: string | null;
  // 옵션 카테고리(음료·유산균 등) 여부. 본품 합계(최소 주문액) 계산에서 제외됨.
  // 기존 데이터 호환을 위해 optional, 없으면 본품으로 간주.
  isOption?: boolean;
};

// 같은 productId라도 deliveryDate가 다르면 별개 라인.
// deliveryDate가 모두 undefined인 옛 항목과의 호환을 위해 빈 문자열로 정규화.
const sameLine = (a: { productId: string; deliveryDate?: string | null }, b: { productId: string; deliveryDate?: string | null }) =>
  a.productId === b.productId && (a.deliveryDate ?? "") === (b.deliveryDate ?? "");

type CartStore = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (productId: string, deliveryDate?: string | null) => void;
  updateQuantity: (productId: string, quantity: number, deliveryDate?: string | null) => void;
  clearCart: () => void;
  // 결제가 끝난 라인만 제거 (배송일별로 나눠 결제할 때 나머지 배송일 상품은 남긴다)
  removeLines: (lines: { productId: string; deliveryDate?: string | null }[]) => void;
  totalItems: () => number;
  totalPrice: () => number;
  // 본품(isOption=false) 합계 — 최소 주문액 검증에 사용
  baseTotalPrice: () => number;
};

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        const existing = get().items.find((i) => sameLine(i, item));
        if (existing) {
          set({
            items: get().items.map((i) =>
              sameLine(i, item) ? { ...i, quantity: i.quantity + item.quantity } : i
            ),
          });
        } else {
          set({ items: [...get().items, item] });
        }
      },

      removeItem: (productId, deliveryDate) => {
        set({ items: get().items.filter((i) => !sameLine(i, { productId, deliveryDate })) });
      },

      updateQuantity: (productId, quantity, deliveryDate) => {
        if (quantity <= 0) {
          get().removeItem(productId, deliveryDate);
          return;
        }
        set({
          items: get().items.map((i) =>
            sameLine(i, { productId, deliveryDate }) ? { ...i, quantity } : i
          ),
        });
      },

      clearCart: () => set({ items: [] }),

      removeLines: (lines) => {
        set({ items: get().items.filter((i) => !lines.some((l) => sameLine(i, l))) });
      },

      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

      totalPrice: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),

      baseTotalPrice: () =>
        get()
          .items.filter((i) => !i.isOption)
          .reduce((sum, i) => sum + i.price * i.quantity, 0),
    }),
    {
      name: "w2o-cart",
    }
  )
);
