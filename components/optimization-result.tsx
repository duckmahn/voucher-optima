"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type OptimizationResult, formatVND } from "@/lib/utils";
import { CheckCircle2, AlertCircle, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { saveVoucher, type NewVoucherInput } from "@/lib/storage";

interface OptimizationResultDisplayProps {
  result: OptimizationResult | null;
}

export function OptimizationResultDisplay({
  result,
}: OptimizationResultDisplayProps) {
  const { status } = useSession();
  const isAuthed = status === "authenticated";
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!result) return;

    try {
      setSaving(true);
      const input: NewVoucherInput = {
        percentage: result.voucher.percentage,
        min_condition: result.voucher.minCondition,
        max_discount: result.voucher.maxDiscount,
        code: "SAVED-" + Math.floor(Math.random() * 1000),
        product_price: result.voucher.productPrice ?? null,
        product_url: result.voucher.productUrl ?? null,
        product_image: result.voucher.productImage ?? null,
        product_name: result.voucher.productName ?? null,
      };
      await saveVoucher(isAuthed, input);

      alert(
        isAuthed
          ? "Voucher saved to your account!"
          : "Voucher saved locally in this browser. Sign in to keep it permanently."
      );
      // Ideally trigger a refresh of the list, but for now a page reload or just knowing it's saved is okay.
      // We can use a global context or SWR/React Query for better state management later.
      window.location.reload();
    } catch (err: any) {
      console.error("Error saving voucher:", err);
      alert("Failed to save voucher: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!result) {
    return (
      <Card className="w-full h-full flex items-center justify-center min-h-75 bg-muted/50 border-dashed">
        <CardContent className="text-center text-muted-foreground">
          <p>Enter voucher details to see the optimization result.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full h-full border-primary/20 shadow-lg">
      <CardHeader className="bg-primary/5 border-b border-primary/10">
        <CardTitle className="flex items-center gap-2 text-primary">
          <CheckCircle2 className="h-6 w-6" />
          Optimization Result
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {result.productCalculation && (
          <div className="flex items-center gap-4 p-4 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900">
            {result.voucher.productImage ? (
              <img
                src={`/api/proxy/images/${result.voucher.productImage}`}
                alt="Product"
                className="w-16 h-16 object-cover rounded-md border bg-white shadow-sm"
              />
            ) : (
              <div className="w-16 h-16 rounded-md bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-2xl">
                🛍️
              </div>
            )}
            <div className="flex-1">
              <h3 className="font-bold text-lg text-indigo-900 dark:text-indigo-100">
                {result.voucher.productName || "Product Analysis"}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                {result.voucher.productUrl && (
                  <a
                    href={result.voucher.productUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium px-2 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 transition-colors"
                  >
                    View Product ↗
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-secondary/30 border border-secondary flex flex-col justify-center">
            <p className="text-sm text-muted-foreground mb-1">
              {result.productCalculation
                ? "Original Price"
                : "Optimal Spend Range"}
            </p>
            <p
              className={`font-bold text-foreground ${
                result.productCalculation
                  ? "text-xl text-muted-foreground line-through decoration-destructive/50"
                  : "text-2xl"
              }`}
            >
              {result.productCalculation
                ? formatVND(result.productCalculation.price)
                : result.range}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900 flex flex-col justify-center">
            <p className="text-sm text-green-700 dark:text-green-300 mb-1">
              {result.productCalculation ? "You Save" : "Max Discount"}
            </p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              -
              {formatVND(
                result.productCalculation
                  ? result.productCalculation.discount
                  : result.discountAmount
              )}
            </p>
          </div>
        </div>
        <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded-bl">
            Final
          </div>
          <p className="text-sm text-primary/80 mb-1">
            {result.productCalculation ? (
              <>Price After Voucher</>
            ) : (
              "Effective Final Price"
            )}
          </p>
          <p className="text-3xl font-extrabold text-primary">
            {formatVND(
              result.productCalculation
                ? result.productCalculation.finalPrice
                : result.finalPrice
            )}
          </p>
        </div>
        <div className="space-y-2 p-4 rounded-lg bg-muted/30 border border-dashed">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Recommendation
          </h3>
          <p className="text-foreground text-base leading-relaxed font-medium">
            {result.message}
          </p>
          {result.productCalculation?.recommendationComment && (
            <div className="mt-3 pt-3 border-t border-dashed border-muted-foreground/20">
              <p className="text-sm text-muted-foreground italic">
                💡 {result.productCalculation.recommendationComment}
              </p>
            </div>
          )}
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Voucher to Database
        </Button>
      </CardContent>
    </Card>
  );
}
