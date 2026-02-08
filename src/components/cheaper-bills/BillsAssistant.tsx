import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sparkles, Send, Loader2, Lightbulb, RefreshCw, MoreHorizontal, Check, X, ThumbsUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEnergyReadings } from "@/hooks/useEnergyReadings";
import { useEnergyTariffs } from "@/hooks/useEnergyTariffs";
import { useRecommendationFeedback, RECOMMENDATION_LABELS } from "@/hooks/useRecommendationFeedback";

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function BillsAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { readings } = useEnergyReadings();
  const { tariffs } = useEnergyTariffs();
  const { alreadyDoing, notRelevant, setFeedback, removeFeedback, isUpdating } = useRecommendationFeedback();

  const currentTariff = tariffs.find(t => t.is_current);

  const sendMessage = async (question?: string) => {
    const messageToSend = question || input;
    if (!messageToSend.trim() && !question) return;

    const userMessage: Message = { role: 'user', content: messageToSend };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-usage-ai', {
        body: {
          question: messageToSend,
          readings: readings.slice(0, 90), // Last 90 readings
          tariff: currentTariff,
        },
      });

      if (error) throw error;

      const assistantMessage: Message = { 
        role: 'assistant', 
        content: data.response 
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('AI error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Sorry, I couldn't analyze your data right now. Please try again.",
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickQuestions = [
    "Analyze my usage patterns",
    "How can I reduce my bill?",
    "Am I using more than average?",
    "What's causing my high usage?",
  ];

  // Get recommendations that user can mark as "already doing"
  const recommendationKeys = Object.keys(RECOMMENDATION_LABELS);
  const excludedKeys = [...alreadyDoing, ...notRelevant];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Bills Assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Excluded tips badges */}
        {excludedKeys.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">I won't suggest these (click to undo):</p>
            <div className="flex flex-wrap gap-1">
              {excludedKeys.map((key) => (
                <Badge
                  key={key}
                  variant="secondary"
                  className="text-xs cursor-pointer hover:bg-destructive/20"
                  onClick={() => removeFeedback(key)}
                >
                  {RECOMMENDATION_LABELS[key] || key}
                  <X className="h-3 w-3 ml-1" />
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Ask me anything about your energy usage:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {quickQuestions.map((q) => (
                <Button
                  key={q}
                  variant="outline"
                  size="sm"
                  onClick={() => sendMessage(q)}
                  disabled={isLoading}
                  className="text-xs justify-start h-auto py-2 px-3"
                >
                  <Lightbulb className="h-3 w-3 mr-1.5 flex-shrink-0" />
                  <span className="text-left">{q}</span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.length > 0 && (
          <ScrollArea className="h-[200px] pr-4">
            <div className="space-y-3">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {/* Input */}
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your energy usage..."
            onKeyDown={(e) => e.key === 'Enter' && !isLoading && sendMessage()}
            disabled={isLoading}
          />
          <Button 
            size="icon" 
            onClick={() => sendMessage()} 
            disabled={isLoading || !input.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {/* Feedback buttons for common recommendations */}
        {messages.length > 0 && (
          <div className="border-t pt-3 space-y-2">
            <p className="text-xs text-muted-foreground">Mark tips you already follow:</p>
            <div className="flex flex-wrap gap-1">
              {recommendationKeys
                .filter(key => !excludedKeys.includes(key))
                .slice(0, 6)
                .map((key) => (
                  <DropdownMenu key={key}>
                    <DropdownMenuTrigger asChild>
                      <Badge
                        variant="outline"
                        className="text-xs cursor-pointer hover:bg-muted"
                      >
                        {RECOMMENDATION_LABELS[key]}
                        <MoreHorizontal className="h-3 w-3 ml-1" />
                      </Badge>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem
                        onClick={() => setFeedback({ recommendation_key: key, status: 'already_do' })}
                        disabled={isUpdating}
                      >
                        <Check className="h-4 w-4 mr-2" />
                        I already do this
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setFeedback({ recommendation_key: key, status: 'not_relevant' })}
                        disabled={isUpdating}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Not relevant to me
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setFeedback({ recommendation_key: key, status: 'helpful' })}
                        disabled={isUpdating}
                      >
                        <ThumbsUp className="h-4 w-4 mr-2" />
                        Helpful tip
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ))}
            </div>
          </div>
        )}

        {/* Reset */}
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMessages([])}
            className="w-full text-xs"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Start new conversation
          </Button>
        )}

        {/* Data status */}
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>{readings.length} readings loaded</span>
          {currentTariff ? (
            <span>Tariff: {currentTariff.provider}</span>
          ) : (
            <span className="text-amber-500">No tariff set</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
