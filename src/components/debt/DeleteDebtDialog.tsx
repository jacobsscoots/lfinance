import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDebts, Debt } from "@/hooks/useDebts";

interface DeleteDebtDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debt?: Debt;
}

export function DeleteDebtDialog({ open, onOpenChange, debt }: DeleteDebtDialogProps) {
  const { deleteDebt } = useDebts();

  const handleDelete = async () => {
    if (!debt) return;
    
    try {
      await deleteDebt.mutateAsync(debt.id);
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Debt</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{debt?.creditor_name}</strong>? 
            This will also delete all associated payments and cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
