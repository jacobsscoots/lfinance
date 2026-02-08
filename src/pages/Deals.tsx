import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Plus, RefreshCw, Search, Rss, Globe, FileText, Link2, 
  CheckCircle2, XCircle, Clock, Trash2, Edit, Play,
  Bell, Filter, ArrowDownAZ, Percent
} from "lucide-react";
import { useDealSources } from "@/hooks/useDealSources";
import { useDealRules } from "@/hooks/useDealRules";
import { useDeals, type DealsFilter } from "@/hooks/useDeals";
import { useDealScanLogs } from "@/hooks/useDealScanLogs";
import { useDealNotifications } from "@/hooks/useDealNotifications";
import { SourceFormDialog } from "@/components/deals/SourceFormDialog";
import { RuleFormDialog } from "@/components/deals/RuleFormDialog";
import { DealCard } from "@/components/deals/DealCard";
import { format, formatDistanceToNow } from "date-fns";

export default function Deals() {
  const [activeTab, setActiveTab] = useState("deals");
  const [showSourceDialog, setShowSourceDialog] = useState(false);
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [editingSource, setEditingSource] = useState<any>(null);
  const [editingRule, setEditingRule] = useState<any>(null);
  
  // Deals filter state
  const [dealsFilter, setDealsFilter] = useState<DealsFilter>({
    sortBy: "newest",
  });
  const [searchInput, setSearchInput] = useState("");

  const { sources, isLoading: sourcesLoading, createSource, updateSource, deleteSource, scanDeals, isScanning, isCreating } = useDealSources();
  const { rules, isLoading: rulesLoading, createRule, updateRule, deleteRule, isCreating: isCreatingRule } = useDealRules();
  const { deals, isLoading: dealsLoading, deleteDeal } = useDeals(dealsFilter);
  const { logs, isLoading: logsLoading } = useDealScanLogs();
  const { notifications, unreadCount, markAllAsRead } = useDealNotifications();

  const handleSearch = () => {
    setDealsFilter({ ...dealsFilter, search: searchInput || undefined });
  };

  const getSourceIcon = (type: string) => {
    switch (type) {
      case "rss": return <Rss className="h-4 w-4" />;
      case "api": return <Globe className="h-4 w-4" />;
      case "html": return <FileText className="h-4 w-4" />;
      default: return <Link2 className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "success": return <Badge className="bg-primary"><CheckCircle2 className="h-3 w-3 mr-1" /> Success</Badge>;
      case "fail": return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Failed</Badge>;
      case "pending": return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
      case "running": return <Badge className="bg-primary"><RefreshCw className="h-3 w-3 mr-1 animate-spin" /> Running</Badge>;
      default: return <Badge variant="outline">Not scanned</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="container py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Deal Scanner</h1>
            <p className="text-muted-foreground">Automatically find and track deals from multiple sources</p>
          </div>
          <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Badge variant="destructive" className="mr-2">
                <Bell className="h-3 w-3 mr-1" /> {unreadCount} new
              </Badge>
            )}
            <Button onClick={() => scanDeals(undefined)} disabled={isScanning}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isScanning ? "animate-spin" : ""}`} />
              {isScanning ? "Scanning..." : "Scan All"}
            </Button>
          </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="deals">Deals</TabsTrigger>
            <TabsTrigger value="sources">Sources</TabsTrigger>
            <TabsTrigger value="rules">Rules</TabsTrigger>
            <TabsTrigger value="logs">Scan Logs</TabsTrigger>
          </TabsList>

          {/* DEALS TAB */}
          <TabsContent value="deals" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 flex gap-2">
                    <Input
                      placeholder="Search deals..."
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    />
                    <Button variant="outline" onClick={handleSearch}>
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Select
                      value={dealsFilter.sortBy}
                      onValueChange={(v) => setDealsFilter({ ...dealsFilter, sortBy: v as any })}
                    >
                      <SelectTrigger className="w-[160px]">
                        <ArrowDownAZ className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Newest First</SelectItem>
                        <SelectItem value="discount">Biggest Discount</SelectItem>
                        <SelectItem value="price_low">Price: Low to High</SelectItem>
                        <SelectItem value="price_high">Price: High to Low</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant={dealsFilter.isNew ? "default" : "outline"}
                      onClick={() => setDealsFilter({ ...dealsFilter, isNew: !dealsFilter.isNew })}
                    >
                      <Filter className="h-4 w-4 mr-2" />
                      New Only
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {dealsLoading ? (
                  <p className="text-center py-8 text-muted-foreground">Loading deals...</p>
                ) : deals.length === 0 ? (
                  <div className="text-center py-12">
                    <Percent className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-semibold text-lg">No deals found</h3>
                    <p className="text-muted-foreground">Add some sources and run a scan to find deals</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {deals.map((deal) => (
                      <DealCard
                        key={deal.id}
                        deal={deal}
                        onDelete={() => deleteDeal(deal.id)}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* SOURCES TAB */}
          <TabsContent value="sources" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => { setEditingSource(null); setShowSourceDialog(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Add Source
              </Button>
            </div>
            
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Scan</TableHead>
                    <TableHead>Enabled</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sourcesLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">Loading...</TableCell>
                    </TableRow>
                  ) : sources.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <p className="text-muted-foreground">No sources configured. Add an RSS feed or API to get started.</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    sources.map((source) => (
                      <TableRow key={source.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getSourceIcon(source.type)}
                            <div>
                              <p className="font-medium">{source.name}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">{source.scan_url}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{source.type.toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(source.last_scan_status)}</TableCell>
                        <TableCell>
                          {source.last_scan_at
                            ? formatDistanceToNow(new Date(source.last_scan_at), { addSuffix: true })
                            : "Never"}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={source.enabled}
                            onCheckedChange={(checked) => updateSource({ id: source.id, enabled: checked })}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => scanDeals(source.id)}
                              disabled={isScanning}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setEditingSource(source); setShowSourceDialog(true); }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteSource(source.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* RULES TAB */}
          <TabsContent value="rules" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => { setEditingRule(null); setShowRuleDialog(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Create Rule
              </Button>
            </div>

            {rulesLoading ? (
              <p className="text-center py-8">Loading...</p>
            ) : rules.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Filter className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg">No rules configured</h3>
                  <p className="text-muted-foreground mb-4">Create rules to filter deals and get notified when matches are found</p>
                  <Button onClick={() => setShowRuleDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Create Your First Rule
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {rules.map((rule) => (
                  <Card key={rule.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{rule.name}</CardTitle>
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={(checked) => updateRule({ id: rule.id, enabled: checked })}
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {rule.keywords_include.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Include keywords:</p>
                          <div className="flex flex-wrap gap-1">
                            {rule.keywords_include.map((kw) => (
                              <Badge key={kw} variant="secondary">{kw}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {(rule.min_price || rule.max_price) && (
                        <p className="text-sm">
                          Price: {rule.min_price ? `£${rule.min_price}` : "Any"} - {rule.max_price ? `£${rule.max_price}` : "Any"}
                        </p>
                      )}
                      {rule.min_discount_percent && (
                        <p className="text-sm">Min discount: {rule.min_discount_percent}%</p>
                      )}
                      <div className="flex items-center gap-2 text-sm">
                        {rule.notify_email && <Badge variant="outline">📧 Email</Badge>}
                        {rule.notify_in_app && <Badge variant="outline">🔔 In-app</Badge>}
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setEditingRule(rule); setShowRuleDialog(true); }}
                        >
                          <Edit className="h-4 w-4 mr-1" /> Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteRule(rule.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" /> Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* LOGS TAB */}
          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Scan History</CardTitle>
                <CardDescription>Recent scanning activity across all sources</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Found</TableHead>
                      <TableHead>Inserted</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logsLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">Loading...</TableCell>
                      </TableRow>
                    ) : logs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No scan logs yet. Run a scan to see activity here.
                        </TableCell>
                      </TableRow>
                    ) : (
                      logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>{log.deal_sources?.name || "Unknown"}</TableCell>
                          <TableCell>{format(new Date(log.started_at), "MMM d, HH:mm")}</TableCell>
                          <TableCell>
                            {log.request_time_ms ? `${(log.request_time_ms / 1000).toFixed(1)}s` : "-"}
                          </TableCell>
                          <TableCell>{getStatusBadge(log.status)}</TableCell>
                          <TableCell>{log.deals_found}</TableCell>
                          <TableCell>{log.deals_inserted}</TableCell>
                          <TableCell className="max-w-[200px] truncate text-destructive">
                            {log.error_message || "-"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <SourceFormDialog
        open={showSourceDialog}
        onOpenChange={setShowSourceDialog}
        initialData={editingSource}
        isSubmitting={isCreating}
        onSubmit={(data) => {
          if (editingSource) {
            updateSource({ id: editingSource.id, ...data, type: data.type as "rss" | "api" | "html" | "manual" });
          } else {
            createSource(data);
          }
          setShowSourceDialog(false);
        }}
      />

      <RuleFormDialog
        open={showRuleDialog}
        onOpenChange={setShowRuleDialog}
        initialData={editingRule}
        isSubmitting={isCreatingRule}
        onSubmit={(data) => {
          if (editingRule) {
            updateRule({ id: editingRule.id, ...data });
          } else {
            createRule(data);
          }
          setShowRuleDialog(false);
        }}
      />
    </AppLayout>
  );
}
