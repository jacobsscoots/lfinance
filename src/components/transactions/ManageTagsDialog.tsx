import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Plus } from "lucide-react";
import { useTransactionTags, TransactionTag } from "@/hooks/useTransactionTags";

interface ManageTagsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TAG_COLORS = [
  "#22c55e", "#3b82f6", "#f59e0b", "#8b5cf6",
  "#ec4899", "#ef4444", "#06b6d4", "#f97316",
  "#64748b", "#10b981",
];

export function ManageTagsDialog({ open, onOpenChange }: ManageTagsDialogProps) {
  const { tags, createTag, updateTag, deleteTag, seedDefaults } = useTransactionTags();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(TAG_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  const handleCreate = () => {
    if (!newName.trim()) return;
    createTag.mutate({ name: newName.trim(), color: newColor }, {
      onSuccess: () => {
        setNewName("");
        setNewColor(TAG_COLORS[0]);
      },
    });
  };

  const handleUpdate = (id: string) => {
    if (!editName.trim()) return;
    updateTag.mutate({ id, name: editName.trim(), color: editColor }, {
      onSuccess: () => setEditingId(null),
    });
  };

  const startEdit = (tag: TransactionTag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Tags</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Create new tag */}
          <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
            <Label className="text-xs text-muted-foreground">New Tag</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Tag name..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="flex-1"
              />
              <Button size="sm" onClick={handleCreate} disabled={!newName.trim() || createTag.isPending}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {TAG_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={`h-6 w-6 rounded-full border-2 transition-transform ${newColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Existing tags */}
          {tags.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground space-y-2">
              <p>No tags yet.</p>
              <Button variant="outline" size="sm" onClick={() => seedDefaults.mutate()}>
                Add example tags
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {tags.map((tag) => (
                <div key={tag.id} className="flex items-center gap-2 p-2 rounded-lg border">
                  {editingId === tag.id ? (
                    <div className="flex-1 space-y-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleUpdate(tag.id)}
                        className="h-8"
                      />
                      <div className="flex gap-1.5 flex-wrap">
                        {TAG_COLORS.map((c) => (
                          <button
                            key={c}
                            onClick={() => setEditColor(c)}
                            className={`h-5 w-5 rounded-full border-2 ${editColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => handleUpdate(tag.id)}>
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                      <span className="flex-1 text-sm font-medium truncate">{tag.name}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(tag)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => deleteTag.mutate(tag.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
