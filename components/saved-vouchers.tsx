import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SavedVouchers() {
  return (
    <Card className="w-full opacity-50 cursor-not-allowed">
      <CardHeader>
        <CardTitle>Saved Vouchers</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Database connection not configured. Please provide Supabase
          credentials to save and load vouchers.
        </p>
      </CardContent>
    </Card>
  );
}
