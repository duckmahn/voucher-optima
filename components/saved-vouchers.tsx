"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetchClient } from "@/lib/api";
import { formatVND } from "@/lib/utils";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type SavedVoucher = {
  id: string;
  code: string | null;
  percentage: number;
  min_condition: number;
  max_discount: number;
  created_at: string;
};

export function SavedVouchers() {
  const [vouchers, setVouchers] = useState<SavedVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchVouchers();
  }, []);

  async function fetchVouchers() {
    try {
      setLoading(true);
      const res = await apiFetchClient('/vouchers');
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
      const data = (await res.json()) as SavedVoucher[];
      setVouchers(data);
    } catch (err: any) {
      console.error("Error fetching vouchers:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteVoucher(id: string) {
    try {
      const res = await apiFetchClient(`/vouchers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Failed to delete: ${res.status}`);
      setVouchers(vouchers.filter((v) => v.id !== id));
    } catch (err: any) {
      console.error("Error deleting voucher:", err);
      alert("Failed to delete voucher");
    }
  }

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Saved Vouchers</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">
            Error Loading Vouchers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Saved Vouchers</CardTitle>
      </CardHeader>
      <CardContent>
        {vouchers.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No saved vouchers found.
          </p>
        ) : (
          <div className="space-y-4">
            {vouchers.map((voucher) => (
              <div
                key={voucher.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {voucher.code ? (
                      <span className="font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded text-xs">
                        {voucher.code}
                      </span>
                    ) : (
                      <span>Voucher</span>
                    )}
                    <span className="text-green-600 font-bold">
                      {voucher.percentage}% Off
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Min: {formatVND(voucher.min_condition)} • Max Cap:{" "}
                    {formatVND(voucher.max_discount)}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteVoucher(voucher.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
