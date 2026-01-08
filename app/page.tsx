"use client";

import { useState } from "react";
import { VoucherForm } from "@/components/voucher-form";
import { OptimizationResultDisplay } from "@/components/optimization-result";
import { SavedVouchers } from "@/components/saved-vouchers";
import { type OptimizationResult } from "@/lib/utils";
import { PriceComparison } from "@/components/price-comparison";
import { SavedComparisons } from "@/components/saved-comparisons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Home() {
  const [result, setResult] = useState<OptimizationResult | null>(null);

  return (
    <main className="min-h-screen bg-background p-4 md:p-8 lg:p-12">
      <div className="max-w-5xl mx-auto space-y-12">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl text-primary">
            Voucher Optima
          </h1>
          <p className="text-muted-foreground text-lg">
            Calculate the optimal price to maximize your voucher savings.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="space-y-8">
            <VoucherForm onCalculate={setResult} />
            <section>
              <h2 className="text-2xl font-semibold mb-4">Saved Items</h2>
              <Tabs defaultValue="vouchers" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="vouchers">Saved Vouchers</TabsTrigger>
                  <TabsTrigger value="comparisons">
                    Saved Comparisons
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="vouchers" className="mt-4">
                  <SavedVouchers />
                </TabsContent>
                <TabsContent value="comparisons" className="mt-4">
                  <SavedComparisons />
                </TabsContent>
              </Tabs>
            </section>

            <section>
              <PriceComparison />
            </section>
          </div>
          <div className="lg:sticky lg:top-8">
            <OptimizationResultDisplay result={result} />
          </div>
        </div>
      </div>
    </main>
  );
}
