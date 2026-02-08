import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Debt } from "@/hooks/useDebts";
import { DebtPaymentWithDebt } from "@/hooks/useDebtPayments";
import { DebtTransaction, PaymentTransactionLink } from "@/hooks/useDebtTransactions";
import { DebtSettings } from "@/hooks/useDebtSettings";
import { exportPaymentsCsv, exportTransactionsCsv } from "@/lib/debtCsvParser";
import { PayoffPlanCard } from "./PayoffPlanCard";
import { Download, FileText, Printer } from "lucide-react";

interface DebtReportsTabProps {
  debts: Debt[];
  payments: DebtPaymentWithDebt[];
  transactions: DebtTransaction[];
  links: PaymentTransactionLink[];
  settings: DebtSettings | null;
}

export function DebtReportsTab({
  debts,
  payments,
  transactions,
  links,
  settings,
}: DebtReportsTabProps) {
  const downloadCsv = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPayments = () => {
    const paymentsData = payments.map(p => ({
      payment_date: p.payment_date,
      amount: Number(p.amount),
      category: p.category,
      creditor_name: p.debts?.creditor_name,
      notes: p.notes,
      principal_amount: p.principal_amount ? Number(p.principal_amount) : null,
      interest_amount: p.interest_amount ? Number(p.interest_amount) : null,
      fee_amount: p.fee_amount ? Number(p.fee_amount) : null,
      matched: links.some(l => l.payment_id === p.id),
    }));
    
    const csv = exportPaymentsCsv(paymentsData);
    downloadCsv(csv, 'debt-payments.csv');
  };

  const handleExportTransactions = () => {
    const csv = exportTransactionsCsv(transactions);
    downloadCsv(csv, 'debt-transactions.csv');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Payoff Plan */}
      <PayoffPlanCard debts={debts} />

      {/* Exports */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Export Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={handleExportPayments}>
              <Download className="h-4 w-4 mr-2" />
              Export Payments (CSV)
            </Button>
            <Button variant="outline" onClick={handleExportTransactions}>
              <Download className="h-4 w-4 mr-2" />
              Export Transactions (CSV)
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Printable Report (hidden on screen, shown on print) */}
      <div className="hidden print:block space-y-6">
        <div className="text-center border-b pb-4">
          <h1 className="text-2xl font-bold">Debt Report</h1>
          <p className="text-muted-foreground">Generated on {new Date().toLocaleDateString()}</p>
        </div>

        {/* Summary */}
        <div>
          <h2 className="text-lg font-semibold mb-2">Summary</h2>
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="py-1">Total Debts</td>
                <td className="text-right">{debts.length}</td>
              </tr>
              <tr>
                <td className="py-1">Open Debts</td>
                <td className="text-right">{debts.filter(d => d.status === 'open').length}</td>
              </tr>
              <tr>
                <td className="py-1">Total Balance</td>
                <td className="text-right">
                  £{debts.filter(d => d.status === 'open').reduce((sum, d) => sum + Number(d.current_balance), 0).toLocaleString()}
                </td>
              </tr>
              <tr>
                <td className="py-1">Total Payments</td>
                <td className="text-right">{payments.length}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Debts List */}
        <div>
          <h2 className="text-lg font-semibold mb-2">Debts</h2>
          <table className="w-full text-sm border">
            <thead>
              <tr className="bg-muted">
                <th className="text-left p-2 border">Creditor</th>
                <th className="text-left p-2 border">Type</th>
                <th className="text-right p-2 border">Balance</th>
                <th className="text-right p-2 border">APR</th>
                <th className="text-left p-2 border">Status</th>
              </tr>
            </thead>
            <tbody>
              {debts.map(d => (
                <tr key={d.id}>
                  <td className="p-2 border">{d.creditor_name}</td>
                  <td className="p-2 border">{d.debt_type}</td>
                  <td className="text-right p-2 border">£{Number(d.current_balance).toLocaleString()}</td>
                  <td className="text-right p-2 border">{d.apr ? `${d.apr}%` : '-'}</td>
                  <td className="p-2 border">{d.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Recent Payments */}
        <div>
          <h2 className="text-lg font-semibold mb-2">Recent Payments</h2>
          <table className="w-full text-sm border">
            <thead>
              <tr className="bg-muted">
                <th className="text-left p-2 border">Date</th>
                <th className="text-left p-2 border">Creditor</th>
                <th className="text-right p-2 border">Amount</th>
                <th className="text-left p-2 border">Category</th>
              </tr>
            </thead>
            <tbody>
              {payments.slice(0, 20).map(p => (
                <tr key={p.id}>
                  <td className="p-2 border">{p.payment_date}</td>
                  <td className="p-2 border">{p.debts?.creditor_name}</td>
                  <td className="text-right p-2 border">£{Number(p.amount).toFixed(2)}</td>
                  <td className="p-2 border">{p.category}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
