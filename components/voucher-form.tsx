"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { z } from "zod";
import { apiFetchClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  calculateOptimalRange,
  type Voucher,
  type OptimizationResult,
} from "@/lib/utils";
import { MoneyInput } from "@/components/ui/money-input";

const formSchema = z.object({
  percentage: z.coerce
    .number()
    .min(1, "Percentage must be at least 1")
    .max(100, "Percentage cannot exceed 100"),
  minCondition: z.coerce
    .number()
    .min(0, "Minimum condition must be non-negative"),
  maxDiscount: z.coerce.number().min(0, "Max discount must be non-negative"),
  productPrice: z.coerce.number().optional(),
  productUrl: z.string().url().optional().or(z.literal("")),
  productImage: z.string().optional().or(z.literal("")),
  productName: z.string().optional(),
});

interface VoucherFormProps {
  onCalculate: (result: OptimizationResult) => void;
}

export function VoucherForm({ onCalculate }: VoucherFormProps) {
  const [fetchingProduct, setFetchingProduct] = useState(false);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      percentage: 10,
      minCondition: 0,
      maxDiscount: 50,
    },
  });

  async function handleUrlBlur(url: string) {
    if (!url) return;
    setFetchingProduct(true);
    try {
      const res = await apiFetchClient('/product/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) return;
      const data = await res.json() as { name: string | null; price: number | null; imageKey: string | null };
      if (data.name) form.setValue('productName', data.name);
      if (data.price) form.setValue('productPrice', data.price);
      if (data.imageKey) form.setValue('productImage', data.imageKey);
    } catch {
      // non-fatal
    } finally {
      setFetchingProduct(false);
    }
  }

  function onSubmit(values: z.infer<typeof formSchema>) {
    const result = calculateOptimalRange(values);
    onCalculate(result);
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Voucher Details</CardTitle>
        <CardDescription>
          Enter the voucher parameters to calculate the optimal usage.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="p-4 bg-muted/30 rounded-lg space-y-4 border border-dashed">
              <h3 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
                🛍️ Product Context (Optional)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="productName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. iPhone 15"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="productPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Price</FormLabel>
                      <FormControl>
                        <MoneyInput
                          placeholder="Enter product price..."
                          value={field.value as number}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="productUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        Product Link
                        {fetchingProduct && (
                          <span className="text-xs text-muted-foreground animate-pulse">
                            Fetching…
                          </span>
                        )}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://..."
                          {...field}
                          value={field.value?.toString() || ""}
                          onBlur={(e) => handleUrlBlur(e.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="productImage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Image</FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          {field.value && (
                            <img
                              src={`/api/proxy/images/${field.value}`}
                              alt="Product preview"
                              className="w-20 h-20 object-cover rounded border"
                            />
                          )}
                          <Input
                            type="file"
                            accept="image/*"
                            className="cursor-pointer"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const formData = new FormData();
                              formData.append('file', file);
                              try {
                                const res = await fetch('/api/proxy/images/upload', {
                                  method: 'POST',
                                  body: formData,
                                });
                                if (res.ok) {
                                  const { imageKey } = await res.json() as { imageKey: string };
                                  field.onChange(imageKey);
                                }
                              } catch {
                                // non-fatal
                              }
                            }}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-medium text-sm text-muted-foreground">
                🎫 Voucher Terms
              </h3>
              <FormField
                control={form.control}
                name="percentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discount Percentage (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="10"
                        {...field}
                        value={field.value as number}
                      />
                    </FormControl>
                    <FormDescription>
                      The percentage value of the voucher.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="minCondition"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum Condition</FormLabel>
                    <FormControl>
                      <MoneyInput
                        placeholder="100.000 ₫"
                        value={field.value as number}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormDescription>
                      Minimum spend required to use the voucher.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="maxDiscount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max Discount Cap</FormLabel>
                    <FormControl>
                      <MoneyInput
                        placeholder="50.000 ₫"
                        value={field.value as number}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormDescription>
                      The maximum amount you can save.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <Button type="submit" className="w-full">
              Calculate Optimization
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
