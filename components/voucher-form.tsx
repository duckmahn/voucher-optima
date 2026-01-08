"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
});

interface VoucherFormProps {
  onCalculate: (result: OptimizationResult) => void;
}

export function VoucherForm({ onCalculate }: VoucherFormProps) {
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      percentage: 10,
      minCondition: 0,
      maxDiscount: 50,
    },
  });

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
            <Button type="submit" className="w-full">
              Calculate Optimization
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
