"use client";

import { useEffect, useState } from "react";
import { apiFetchClient } from "@/lib/api";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Trash2,
  ExternalLink,
  History,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatVND } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface StoreEntry {
  storeName: string;
  basePrice: number;
  url?: string;
  finalPrice: number;
  discountAmount: number;
  voucher?: any;
}

interface ComparisonData {
  title: string;
  stores: StoreEntry[];
}

interface SavedComparison {
  id: string;
  created_at: string;
  data: ComparisonData;
}

export function SavedComparisons() {
  const [comparisons, setComparisons] = useState<SavedComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchComparisons();
  }, []);

  async function fetchComparisons() {
    try {
      setLoading(true);
      const res = await apiFetchClient('/comparisons');
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
      const data = (await res.json()) as SavedComparison[];
      setComparisons(data);
    } catch (err: any) {
      console.error("Error fetching comparisons:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this comparison?")) return;
    try {
      const res = await apiFetchClient(`/comparisons/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Failed to delete: ${res.status}`);
      setComparisons(comparisons.filter((c) => c.id !== id));
    } catch (err: any) {
      alert("Error deleting comparison: " + err.message);
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full border-destructive/20 bg-destructive/5">
        <CardContent className="p-6 text-center text-destructive">
          <p>Error loading saved comparisons: {error}</p>
          <Button variant="outline" onClick={fetchComparisons} className="mt-4">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (comparisons.length === 0) {
    return (
      <Card className="w-full border-dashed">
        <CardContent className="p-8 text-center text-muted-foreground">
          <History className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p>No saved comparisons found.</p>
          <p className="text-sm mt-2">
            Compare prices and save them to see them here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {comparisons.map((comp) => (
        <Card key={comp.id} className="overflow-hidden">
          <div
            className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => toggleExpand(comp.id)}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-full ${
                  expandedId === comp.id
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <History className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-medium">
                  {comp.data.title || "Untitled Comparison"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {new Date(comp.created_at).toLocaleDateString()} •{" "}
                  {comp.data.stores.length} stores
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(comp.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              {expandedId === comp.id ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </div>
          </div>

          {expandedId === comp.id && (
            <div className="border-t bg-muted/10 p-4 space-y-3">
              {comp.data.stores.map((store, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border flex items-center justify-between ${
                    idx === 0
                      ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900"
                      : "bg-card"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="font-medium">
                      {store.url ? (
                        <a
                          href={store.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline flex items-center gap-1 text-blue-600 dark:text-blue-400"
                        >
                          {store.storeName}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        store.storeName
                      )}
                    </div>
                    {idx === 0 && (
                      <Badge
                        variant="secondary"
                        className="bg-green-100 text-green-700 hover:bg-green-100"
                      >
                        Best Price
                      </Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-bold">
                      {formatVND(store.finalPrice)}
                    </div>
                    {store.discountAmount > 0 && (
                      <div className="text-xs text-green-600">
                        Saved {formatVND(store.discountAmount)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
