import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatVND(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

export type Voucher = {
  percentage: number;
  minCondition: number;
  maxDiscount: number;
  productPrice?: number;
  productUrl?: string;
  productImage?: string;
  productName?: string;
};

export type ProductCalculation = {
  price: number;
  discount: number;
  finalPrice: number;
  isOptimal: boolean;
  message: string;
  recommendationComment?: string;
};

export type OptimizationResult = {
  optimalPrice: number;
  discountAmount: number;
  finalPrice: number;
  message: string;
  range?: string;
  voucher: Voucher;
  productCalculation?: ProductCalculation;
};

export function calculateOptimalRange(voucher: Voucher): OptimizationResult {
  const { percentage, minCondition, maxDiscount } = voucher;

  // Calculate the price where we hit the max discount
  // price * (percentage / 100) = maxDiscount
  // price = maxDiscount / (percentage / 100)
  // price * (percentage / 100) = maxDiscount
  // price = maxDiscount / (percentage / 100)
  const priceForMaxDiscount = Math.ceil(maxDiscount / (percentage / 100));

  // If the price for max discount is less than min condition,
  // then the optimal price starts at min condition (but we are capped at max discount immediately if minCondition * % > maxDiscount, which is unlikely for valid vouchers but possible)
  // Actually, if minCondition * % > maxDiscount, then any price >= minCondition gives maxDiscount.

  const optimalPrice = Math.max(minCondition, priceForMaxDiscount);

  // Calculate discount at optimal price
  const discountAtOptimal = Math.floor(
    Math.min(optimalPrice * (percentage / 100), maxDiscount)
  );

  let message = "";
  let range = "";

  if (priceForMaxDiscount < minCondition) {
    // This means even at min condition, we are already capped (or exceeding) max discount?
    // Example: 10% off, min 100, max 5.
    // 100 * 0.1 = 10. 10 > 5. So at 100 we get 5 off.
    // priceForMaxDiscount = 5 / 0.1 = 50.
    // So optimal is 100.
    message = `The minimum spend of ${formatVND(
      minCondition
    )} already exceeds the max discount cap. You get the maximum discount of ${formatVND(
      maxDiscount
    )} starting from ${formatVND(minCondition)}.`;
    range = `>= ${formatVND(minCondition)}`;
  } else {
    // Normal case: 10% off, min 100, max 50.
    // priceForMaxDiscount = 50 / 0.1 = 500.
    // At 500, we get 50 off.
    // Between 100 and 500, we get 10% off.
    // Optimal point to maximize "percentage usage" is up to 500.
    // But to maximize "absolute discount amount", it is >= 500.
    message = `To get the maximum discount of ${formatVND(
      maxDiscount
    )}, you should spend at least ${formatVND(priceForMaxDiscount)}.`;
    range = `>= ${formatVND(priceForMaxDiscount)}`;
  }

  let productCalculation: ProductCalculation | undefined;

  if (voucher.productPrice) {
    const price = voucher.productPrice;
    let discount = 0;
    let message = "";
    let isOptimal = false;

    if (price < minCondition) {
      message = `This product price (${formatVND(
        price
      )}) is below the minimum spend of ${formatVND(
        minCondition
      )}. No discount applied.`;
    } else {
      const calculatedDiscount = price * (percentage / 100);
      discount = Math.floor(Math.min(calculatedDiscount, maxDiscount));

      if (discount === maxDiscount) {
        isOptimal = true;
        message =
          "Great! You are getting the maximum possible discount with this product.";
      } else if (price < priceForMaxDiscount) {
        message = `You are getting ${formatVND(
          discount
        )} off. Spend ${formatVND(
          priceForMaxDiscount - price
        )} more to reach the max discount of ${formatVND(maxDiscount)}.`;
      } else {
        // Should be covered by max discount case, but just in case
        isOptimal = true;
        message = "You are getting the maximum discount.";
      }
    }

    productCalculation = {
      price,
      discount,
      finalPrice: price - discount,
      isOptimal,
      message,
      recommendationComment:
        price < minCondition
          ? `You need to spend ${formatVND(
              minCondition - price
            )} more to reach the minimum condition.`
          : price < priceForMaxDiscount
          ? `You are using the voucher, but you could save more. Spend ${formatVND(
              priceForMaxDiscount - price
            )} more to get the maximum discount of ${formatVND(maxDiscount)}.`
          : price > priceForMaxDiscount
          ? `You are spending ${formatVND(
              price - priceForMaxDiscount
            )} more than necessary for the max discount. You could reduce your spending and still get the same ${formatVND(
              maxDiscount
            )} discount.`
          : "You are spending exactly the optimal amount for the maximum discount.",
    };
  }

  return {
    optimalPrice: Math.round(Math.max(minCondition, priceForMaxDiscount)),
    discountAmount: Math.round(discountAtOptimal),
    finalPrice: Math.round(
      Math.max(minCondition, priceForMaxDiscount) - discountAtOptimal
    ),
    message,
    range,
    voucher,
    productCalculation,
  };
}

export type StoreOption = {
  id: string;
  storeName: string;
  basePrice: number;
  url?: string;
  voucher?: Voucher;
};

export type ComparisonResult = {
  storeOption: StoreOption;
  finalPrice: number;
  discountAmount: number;
  appliedVoucher: boolean;
};

export function comparePrices(options: StoreOption[]): ComparisonResult[] {
  const results = options.map((option) => {
    let finalPrice = option.basePrice;
    let discountAmount = 0;
    let appliedVoucher = false;

    if (option.voucher) {
      const { percentage, minCondition, maxDiscount } = option.voucher;

      if (option.basePrice >= minCondition) {
        // Calculate discount
        const calculatedDiscount = option.basePrice * (percentage / 100);
        discountAmount = Math.floor(Math.min(calculatedDiscount, maxDiscount));
        finalPrice = option.basePrice - discountAmount;
        appliedVoucher = true;
      }
    }

    return {
      storeOption: option,
      finalPrice,
      discountAmount,
      appliedVoucher,
    };
  });

  // Sort by final price ascending
  return results.sort((a, b) => a.finalPrice - b.finalPrice);
}
