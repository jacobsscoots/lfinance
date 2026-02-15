import { useState, useEffect, useMemo } from "react";
import { CreditCard, Gift, CircleCheck, Coins } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useEasySaverBalance } from "@/hooks/useEasySaverBalance";
import { toast } from "sonner";

interface EasySaverCalculatorProps {
  /** Auto-calculated Iceland shop total from the shopping list */
  icelandTotal?: number;
}

export function EasySaverCalculator({ icelandTotal = 0 }: EasySaverCalculatorProps) {
  const { cardBalance: savedBalance, updateBalance } = useEasySaverBalance();

  const [cardBalanceInput, setCardBalanceInput] = useState("");
  const [shopTotalInput, setShopTotalInput] = useState("");
  const [balanceSynced, setBalanceSynced] = useState(false);

  // Sync saved balance on load
  useEffect(() => {
    if (savedBalance > 0 && !balanceSynced) {
      setCardBalanceInput(savedBalance.toFixed(2));
      setBalanceSynced(true);
    }
  }, [savedBalance, balanceSynced]);

  // Auto-populate shop total from Iceland retailer group
  useEffect(() => {
    if (icelandTotal > 0) {
      setShopTotalInput(icelandTotal.toFixed(2));
    }
  }, [icelandTotal]);

  const cardBalance = parseFloat(cardBalanceInput) || 0;
  const shopTotal = parseFloat(shopTotalInput) || 0;

  const calc = useMemo(() => {
    if (shopTotal <= 0) return null;

    const remaining = shopTotal - cardBalance;

    if (remaining <= 0) {
      // Card covers everything
      return {
        type: "covered" as const,
        remainingOnCard: Math.abs(remaining),
        giftCardToBuy: 0,
        paySeparately: 0,
      };
    }

    const giftCardToBuy = Math.floor(remaining);
    const paySeparately = +(remaining - giftCardToBuy).toFixed(2);

    return {
      type: giftCardToBuy >= 1 ? ("buy" as const) : ("small" as const),
      remainingOnCard: 0,
      giftCardToBuy,
      paySeparately: giftCardToBuy >= 1 ? paySeparately : remaining,
    };
  }, [cardBalance, shopTotal]);

  const handleSaveBalance = () => {
    updateBalance.mutate(cardBalance, {
      onSuccess: () => toast.success("Card balance saved"),
    });
  };

  return (
    <Card className="border-destructive/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-5 w-5 text-destructive" />
          Easy Saver Gift Card Calculator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="card-balance" className="text-xs">Current Card Balance</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">£</span>
              <Input
                id="card-balance"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={cardBalanceInput}
                onChange={(e) => setCardBalanceInput(e.target.value)}
                className="pl-7"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shop-total" className="text-xs">
              Estimated Shop Total
              {icelandTotal > 0 && (
                <span className="text-primary ml-1">(auto)</span>
              )}
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">£</span>
              <Input
                id="shop-total"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={shopTotalInput}
                onChange={(e) => setShopTotalInput(e.target.value)}
                className="pl-7"
              />
            </div>
          </div>
        </div>

        {/* Results */}
        {calc && (
          <div className="rounded-lg bg-muted/50 p-3 space-y-2">
            {calc.type === "covered" && (
              <div className="flex items-start gap-2">
                <CircleCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">No gift card needed</p>
                  <p className="text-xs text-muted-foreground">
                    Your card covers it — £{calc.remainingOnCard.toFixed(2)} will remain on your card
                  </p>
                </div>
              </div>
            )}

            {calc.type === "buy" && (
              <>
                <div className="flex items-start gap-2">
                  <Gift className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">
                      Buy a <span className="text-lg font-bold">£{calc.giftCardToBuy}</span> gift card
                    </p>
                  </div>
                </div>
                {calc.paySeparately > 0 && (
                  <div className="flex items-start gap-2">
                    <Coins className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground">
                      Pay £{calc.paySeparately.toFixed(2)} separately at checkout
                    </p>
                  </div>
                )}
              </>
            )}

            {calc.type === "small" && (
              <div className="flex items-start gap-2">
                <Coins className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">No gift card needed</p>
                  <p className="text-xs text-muted-foreground">
                    Just pay £{calc.paySeparately.toFixed(2)} at checkout — too small for a gift card
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Save balance button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleSaveBalance}
          disabled={updateBalance.isPending || cardBalance === savedBalance}
        >
          {updateBalance.isPending ? "Saving…" : "Save Card Balance"}
        </Button>
      </CardContent>
    </Card>
  );
}
