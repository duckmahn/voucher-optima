import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type OptimizationResult, formatVND } from "@/lib/utils";
import { CheckCircle2, AlertCircle, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface OptimizationResultDisplayProps {
  result: OptimizationResult | null;
}

export function OptimizationResultDisplay({
  result,
}: OptimizationResultDisplayProps) {
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!result) return;

    try {
      setSaving(true);
      const { error } = await supabase.from("vouchers").insert({
        percentage: result.voucher.percentage,
        min_condition: result.voucher.minCondition,
        max_discount: result.voucher.maxDiscount,
        code: "SAVED-" + Math.floor(Math.random() * 1000), // Simple auto-generated code
      });

      if (error) throw error;

      alert("Voucher saved successfully!");
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
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">
            Recommendation
          </h3>
          <p className="text-muted-foreground text-lg leading-relaxed">
            {result.message}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-secondary/50 border border-secondary">
            <p className="text-sm text-muted-foreground mb-1">
              Optimal Spend Range
            </p>
            <p className="text-2xl font-bold text-foreground">{result.range}</p>
          </div>
          <div className="p-4 rounded-lg bg-secondary/50 border border-secondary">
            <p className="text-sm text-muted-foreground mb-1">Max Discount</p>
            <p className="text-2xl font-bold text-green-600">
              -{formatVND(result.discountAmount)}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-secondary/50 border border-secondary">
            <p className="text-sm text-muted-foreground mb-1">
              Effective Final Price
            </p>
            <p className="text-2xl font-bold text-foreground">
              {formatVND(result.finalPrice)}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p>
            Spending more than the optimal price will not increase your discount
            amount, effectively lowering your percentage savings.
          </p>
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
