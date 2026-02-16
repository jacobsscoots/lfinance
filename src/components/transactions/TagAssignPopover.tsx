import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tag, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagInfo {
  id: string;
  name: string;
  color: string;
}

interface TagAssignPopoverProps {
  transactionId: string;
  allTags: TagInfo[];
  assignedTagIds: string[];
  onAssign: (tagId: string) => void;
  onUnassign: (tagId: string) => void;
}

export function TagAssignPopover({
  transactionId,
  allTags,
  assignedTagIds,
  onAssign,
  onUnassign,
}: TagAssignPopoverProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded hover:bg-muted">
          <Tag className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <p className="text-xs font-medium text-muted-foreground mb-2 px-1">Assign tags</p>
        {allTags.length === 0 ? (
          <p className="text-xs text-muted-foreground px-1 py-2">No tags yet. Create tags in Manage Tags.</p>
        ) : (
          <div className="space-y-0.5 max-h-48 overflow-y-auto">
            {allTags.map((tag) => {
              const isAssigned = assignedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => isAssigned ? onUnassign(tag.id) : onAssign(tag.id)}
                  className={cn(
                    "flex items-center gap-2 w-full text-left px-2 py-1.5 rounded text-sm hover:bg-muted transition-colors",
                    isAssigned && "bg-muted"
                  )}
                >
                  <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                  <span className="flex-1 truncate">{tag.name}</span>
                  {isAssigned && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface TransactionTagBadgesProps {
  tagIds: string[];
  allTags: TagInfo[];
}

export function TransactionTagBadges({ tagIds, allTags }: TransactionTagBadgesProps) {
  if (tagIds.length === 0) return null;

  const tagMap = new Map(allTags.map(t => [t.id, t]));

  return (
    <>
      {tagIds.map((id) => {
        const tag = tagMap.get(id);
        if (!tag) return null;
        return (
          <Badge
            key={id}
            variant="secondary"
            className="text-[10px] py-0 px-1.5 gap-1"
            style={{ backgroundColor: `${tag.color}20`, color: tag.color, borderColor: `${tag.color}40` }}
          >
            {tag.name}
          </Badge>
        );
      })}
    </>
  );
}
