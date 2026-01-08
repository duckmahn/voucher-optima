import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type Voucher = {
  percentage: number;
  minCondition: number;
  maxDiscount: number;
};

export type OptimizationResult = {
  optimalPrice: number;
  discountAmount: number;
  finalPrice: number;
  message: string;
  range?: string;
};

export function calculateOptimalRange(voucher: Voucher): OptimizationResult {
  const { percentage, minCondition, maxDiscount } = voucher;

  // Calculate the price where we hit the max discount
  // price * (percentage / 100) = maxDiscount
  // price = maxDiscount / (percentage / 100)
  const priceForMaxDiscount = maxDiscount / (percentage / 100);

  // If the price for max discount is less than min condition,
  // then the optimal price starts at min condition (but we are capped at max discount immediately if minCondition * % > maxDiscount, which is unlikely for valid vouchers but possible)
  // Actually, if minCondition * % > maxDiscount, then any price >= minCondition gives maxDiscount.

  const optimalPrice = Math.max(minCondition, priceForMaxDiscount);

  // Calculate discount at optimal price
  const discountAtOptimal = Math.min(
    optimalPrice * (percentage / 100),
    maxDiscount
  );

  let message = "";
  let range = "";

  if (priceForMaxDiscount < minCondition) {
    // This means even at min condition, we are already capped (or exceeding) max discount?
    // Example: 10% off, min 100, max 5.
    // 100 * 0.1 = 10. 10 > 5. So at 100 we get 5 off.
    // priceForMaxDiscount = 5 / 0.1 = 50.
    // So optimal is 100.
    message = `The minimum spend of ${minCondition} already exceeds the max discount cap. You get the maximum discount of ${maxDiscount} starting from ${minCondition}.`;
    range = `>= ${minCondition}`;
  } else {
    // Normal case: 10% off, min 100, max 50.
    // priceForMaxDiscount = 50 / 0.1 = 500.
    // At 500, we get 50 off.
    // Between 100 and 500, we get 10% off.
    // Optimal point to maximize "percentage usage" is up to 500.
    // But to maximize "absolute discount amount", it is >= 500.
    message = `To get the maximum discount of ${maxDiscount}, you should spend at least ${priceForMaxDiscount}.`;
    range = `>= ${priceForMaxDiscount}`;
  }

  return {
    optimalPrice: Math.max(minCondition, priceForMaxDiscount),
    discountAmount: discountAtOptimal,
    finalPrice: Math.max(minCondition, priceForMaxDiscount) - discountAtOptimal,
    message,
    range,
  };
}
