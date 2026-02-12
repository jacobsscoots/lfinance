import { useState } from "react";
import ExcelJS from "exceljs";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

const SAMPLE_BILLS = [
  ["Name", "Amount", "Frequency", "Due Day", "Provider", "Type", "Notes"],
  ["Council Tax", 180, "Monthly", 1, "Local Council", "Tax", "Band C"],
  ["Electricity", 95, "Monthly", 15, "Octopus Energy", "Utility", ""],
  ["Water", 42, "Monthly", 20, "Thames Water", "Utility", ""],
];

const SAMPLE_SUBSCRIPTIONS = [
  ["Name", "Amount", "Frequency", "Due Day", "Provider", "Notes"],
  ["Netflix", 15.99, "Monthly", 5, "Netflix", "Standard plan"],
  ["Spotify", 10.99, "Monthly", 12, "Spotify", "Premium"],
  ["Amazon Prime", 95, "Yearly", 1, "Amazon", "Annual"],
];

const SAMPLE_DEBTS = [
  ["Creditor Name", "Debt Type", "Starting Balance", "Current Balance", "APR", "Min Payment", "Due Day", "Notes"],
  ["Barclaycard", "Credit Card", 3500, 2800, 22.9, 85, 25, ""],
  ["Klarna", "BNPL", 450, 300, 0, 75, 1, "3 instalments"],
  ["Personal Loan", "Loan", 10000, 7500, 5.9, 200, 15, "Halifax"],
];

export function SampleTemplateDownload() {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet("Settings");

      // Bills section
      ws.addRow(["Bills"]);
      SAMPLE_BILLS.forEach((row) => ws.addRow(row));
      ws.addRow([]);

      // Subscriptions section
      ws.addRow(["Subscriptions"]);
      SAMPLE_SUBSCRIPTIONS.forEach((row) => ws.addRow(row));
      ws.addRow([]);

      // Debts section
      ws.addRow(["Debts"]);
      SAMPLE_DEBTS.forEach((row) => ws.addRow(row));

      // Set column widths
      ws.columns = [
        { width: 20 }, { width: 15 }, { width: 15 }, { width: 10 },
        { width: 18 }, { width: 12 }, { width: 15 }, { width: 20 },
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "life-tracker-import-template.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleDownload} disabled={downloading}>
      <Download className="h-4 w-4 mr-2" />
      Download Template
    </Button>
  );
}
