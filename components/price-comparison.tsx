"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  comparePrices,
  type StoreOption,
  type ComparisonResult,
  formatVND,
} from "@/lib/utils";
import {
  Plus,
  Trash2,
  ShoppingBag,
  Tag,
  Save,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { MoneyInput } from "@/components/ui/money-input";

const storeSchema = z.object({
  storeName: z.string().min(1, "Store name is required"),
  basePrice: z.coerce.number().min(0, "Price must be non-negative"),
  url: z.string().url("Invalid URL").optional().or(z.literal("")),
  hasVoucher: z.boolean().default(false),
  percentage: z.coerce.number().min(0).max(100).optional(),
  minCondition: z.coerce.number().min(0).optional(),
  maxDiscount: z.coerce.number().min(0).optional(),
});

const formSchema = z.object({
  stores: z.array(storeSchema).min(1, "Add at least one store to compare"),
});

export function PriceComparison() {
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [saving, setSaving] = useState(false);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      stores: [
        {
          storeName: "",
          basePrice: 0,
          url: "",
          hasVoucher: false,
          percentage: 10,
          minCondition: 0,
          maxDiscount: 50,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "stores",
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    const options: StoreOption[] = values.stores.map((store, index) => ({
      id: index.toString(),
      storeName: store.storeName,
      basePrice: store.basePrice,
      url: store.url,
      voucher: store.hasVoucher
        ? {
            percentage: store.percentage || 0,
            minCondition: store.minCondition || 0,
            maxDiscount: store.maxDiscount || 0,
          }
        : undefined,
    }));

    const comparison = comparePrices(options);
    setResults(comparison);
  }

  async function handleSave() {
    if (results.length === 0) return;

    try {
      setSaving(true);
      // Create a simplified version of stores to save
      const storesToSave = results.map((r) => ({
        storeName: r.storeOption.storeName,
        basePrice: r.storeOption.basePrice,
        url: r.storeOption.url,
        finalPrice: r.finalPrice,
        discountAmount: r.discountAmount,
        voucher: r.storeOption.voucher,
      }));

      const { error } = await supabase.from("saved_comparisons").insert({
        title: `Comparison - ${new Date().toLocaleString()}`,
        stores: storesToSave,
      });

      if (error) throw error;

      alert("Comparison saved successfully!");
      window.location.reload(); // Refresh to show in saved list
    } catch (err: any) {
      console.error("Error saving comparison:", err);
      alert("Failed to save comparison: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingBag className="h-6 w-6" />
          Price Comparison
        </CardTitle>
        <CardDescription>
          Compare product prices across different stores with vouchers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-4">
              {fields.map((field, index) => (
                <Card key={field.id} className="p-4 border-dashed relative">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 text-destructive hover:text-destructive/90"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <FormField
                      control={form.control}
                      name={`stores.${index}.storeName`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Store Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Shopee" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`stores.${index}.basePrice`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Base Price</FormLabel>
                          <FormControl>
                            <MoneyInput
                              placeholder="100.000 ₫"
                              value={field.value as number}
                              onChange={field.onChange}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="mb-4">
                    <FormField
                      control={form.control}
                      name={`stores.${index}.url`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Product Link (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="https://..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name={`stores.${index}.hasVoucher`}
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm mb-4">
                        <div className="space-y-0.5">
                          <FormLabel>Apply Voucher?</FormLabel>
                        </div>
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            className="accent-primary h-4 w-4"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {form.watch(`stores.${index}.hasVoucher`) && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/30 p-3 rounded-md">
                      <FormField
                        control={form.control}
                        name={`stores.${index}.percentage`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">
                              Discount %
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                className="h-8"
                                {...field}
                                value={field.value as number}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`stores.${index}.minCondition`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Min Spend</FormLabel>
                            <FormControl>
                              <MoneyInput
                                className="h-8"
                                value={field.value as number}
                                onChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`stores.${index}.maxDiscount`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Max Cap</FormLabel>
                            <FormControl>
                              <MoneyInput
                                className="h-8"
                                value={field.value as number}
                                onChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </Card>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full border-dashed"
              onClick={() =>
                append({
                  storeName: "",
                  basePrice: 0,
                  url: "",
                  hasVoucher: false,
                  percentage: 10,
                  minCondition: 0,
                  maxDiscount: 50,
                })
              }
            >
              <Plus className="h-4 w-4 mr-2" /> Add Another Store
            </Button>

            <Button type="submit" className="w-full">
              Compare Prices
            </Button>
          </form>
        </Form>

        {results.length > 0 && (
          <div className="space-y-4 mt-8">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Best Deals (Sorted)
              </h3>
              <Button
                onClick={handleSave}
                disabled={saving}
                variant="outline"
                size="sm"
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Comparison
              </Button>
            </div>
            <div className="space-y-3">
              {results.map((result, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border flex items-center justify-between ${
                    idx === 0
                      ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900 ring-1 ring-green-500/20"
                      : "bg-card"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      {result.storeOption.url ? (
                        <a
                          href={result.storeOption.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold text-lg hover:underline flex items-center gap-1 text-blue-600 dark:text-blue-400"
                        >
                          {result.storeOption.storeName}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="font-bold text-lg">
                          {result.storeOption.storeName}
                        </span>
                      )}
                      {idx === 0 && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                          Best Price
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Base: {formatVND(result.storeOption.basePrice)}
                      {result.appliedVoucher &&
                        ` • Discount: -${formatVND(result.discountAmount)}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">
                      {formatVND(result.finalPrice)}
                    </div>
                    {result.appliedVoucher && (
                      <div className="text-xs text-green-600">
                        Voucher Applied
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
