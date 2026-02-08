import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Smartphone, ExternalLink, Loader2 } from "lucide-react";
import { useBrightConnection } from "@/hooks/useBrightConnection";

interface BrightConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BrightConnectDialog({ open, onOpenChange }: BrightConnectDialogProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { connect, isConnecting } = useBrightConnection();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    connect(
      { username, password },
      {
        onSuccess: () => {
          setUsername("");
          setPassword("");
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            Connect Smart Meter
          </DialogTitle>
          <DialogDescription>
            Connect your Chameleon IHD via the Bright/Glowmarkt API to automatically import your meter readings.
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertDescription className="text-sm">
            <strong>Requirements:</strong>
            <ol className="list-decimal list-inside mt-2 space-y-1">
              <li>Download the <strong>Bright</strong> app and create an account</li>
              <li>Ensure your Chameleon IHD is connected to WiFi</li>
              <li>Your IHD must be paired with your smart meter</li>
            </ol>
            <a
              href="https://www.hildebrand.co.uk/bright-app/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline mt-2"
            >
              Get the Bright app <ExternalLink className="h-3 w-3" />
            </a>
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Bright Email</Label>
            <Input
              id="username"
              type="email"
              placeholder="your@email.com"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Bright Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isConnecting || !username || !password}>
              {isConnecting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isConnecting ? "Connecting..." : "Connect"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
