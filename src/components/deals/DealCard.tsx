import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Trash2 } from "lucide-react";
import type { Deal } from "@/hooks/useDeals";

interface DealCardProps {
  deal: Deal;
  onDelete?: () => void;
  onMarkRead?: () => void;
}

export function DealCard({ deal, onDelete, onMarkRead }: DealCardProps) {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex gap-4">
          {deal.image_url && (
            <div className="flex-shrink-0">
              <img
                src={deal.image_url}
                alt=""
                className="w-20 h-20 object-cover rounded-md bg-muted"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {deal.is_new && (
                    <Badge className="bg-primary hover:bg-primary/90">NEW</Badge>
                  )}
                  {deal.price_dropped && (
                    <Badge variant="destructive">PRICE DROP</Badge>
                  )}
                  {deal.discount_percent && deal.discount_percent > 0 && (
                    <Badge variant="secondary">{deal.discount_percent.toFixed(0)}% off</Badge>
                  )}
                </div>
                <h3 className="font-medium mt-1 line-clamp-2">{deal.title}</h3>
                <p className="text-sm text-muted-foreground">{deal.store || deal.source_name}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xl font-bold text-primary">
                  {deal.currency === "GBP" ? "£" : deal.currency === "USD" ? "$" : "€"}
                  {deal.price.toFixed(2)}
                </p>
                {deal.old_price && (
                  <p className="text-sm text-muted-foreground line-through">
                    {deal.currency === "GBP" ? "£" : deal.currency === "USD" ? "$" : "€"}
                    {deal.old_price.toFixed(2)}
                  </p>
                )}
              </div>
            </div>
            {deal.description_snippet && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                {deal.description_snippet}
              </p>
            )}
            <div className="flex items-center justify-between mt-3 pt-2 border-t">
              <span className="text-xs text-muted-foreground">
                Found {new Date(deal.first_seen_at).toLocaleDateString()}
              </span>
              <div className="flex gap-2">
                {onDelete && (
                  <Button variant="ghost" size="sm" onClick={onDelete}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="outline" size="sm" asChild>
                  <a href={deal.url} target="_blank" rel="noopener noreferrer">
                    View Deal <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
