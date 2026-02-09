import { useState } from "react";
import * as XLSX from "xlsx";
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

  const handleDownload = () => {
    setDownloading(true);
    try {
      const wb = XLSX.utils.book_new();
      const data: any[][] = [];

      // Bills section
      data.push(["Bills"]);
      data.push(...SAMPLE_BILLS);
      data.push([]);

      // Subscriptions section
      data.push(["Subscriptions"]);
      data.push(...SAMPLE_SUBSCRIPTIONS);
      data.push([]);

      // Debts section
      data.push(["Debts"]);
      data.push(...SAMPLE_DEBTS);

      const ws = XLSX.utils.aoa_to_sheet(data);

      // Set column widths
      ws["!cols"] = [
        { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 10 },
        { wch: 18 }, { wch: 12 }, { wch: 15 }, { wch: 20 },
      ];

      XLSX.utils.book_append_sheet(wb, ws, "Settings");
      XLSX.writeFile(wb, "life-tracker-import-template.xlsx");
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
