import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const etfInputSchema = z.object({
  ticker: z.string().min(1).max(20).regex(/^[A-Za-z0-9._-]+$/, "Invalid ticker format"),
  investment_account_id: z.string().uuid(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rawBody = await req.json();
    const parseResult = etfInputSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return new Response(JSON.stringify({ error: "Invalid input", details: parseResult.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { ticker, investment_account_id } = parseResult.data;

    // Yahoo Finance v8 API for quote data
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=5d&interval=1d`;
    
    const yahooRes = await fetch(yahooUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (!yahooRes.ok) {
      throw new Error(`Yahoo Finance returned ${yahooRes.status}`);
    }

    const yahooData = await yahooRes.json();
    const result = yahooData?.chart?.result?.[0];

    if (!result) {
      throw new Error('No data returned from Yahoo Finance');
    }

    const meta = result.meta;
    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];

    // Get the latest valid close price
    let latestPrice = meta.regularMarketPrice;
    let latestDate = new Date().toISOString().split('T')[0];
    let previousClose = meta.previousClose || meta.chartPreviousClose;

    // Also try to get the most recent closing price from the chart data
    for (let i = timestamps.length - 1; i >= 0; i--) {
      if (closes[i] != null) {
        const ts = new Date(timestamps[i] * 1000);
        latestDate = ts.toISOString().split('T')[0];
        latestPrice = closes[i];
        // Get previous day close
        if (i > 0 && closes[i - 1] != null) {
          previousClose = closes[i - 1];
        }
        break;
      }
    }

    if (!latestPrice) {
      throw new Error('Could not determine current price');
    }

    // Convert pence to pounds if the currency is GBp (pence)
    const currency = meta.currency || 'GBP';
    let priceGBP = latestPrice;
    let prevCloseGBP = previousClose;
    if (currency === 'GBp') {
      priceGBP = latestPrice / 100;
      prevCloseGBP = previousClose ? previousClose / 100 : null;
    }

    // Calculate position value: share price × total units held
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get total units held for this investment
    const { data: txns } = await serviceClient
      .from('investment_transactions')
      .select('type, units, amount')
      .eq('investment_account_id', investment_account_id)
      .eq('user_id', user.id);

    let totalUnits = 0;
    if (txns) {
      for (const tx of txns) {
        const u = tx.units ? Number(tx.units) : 0;
        if (tx.type === 'deposit' || tx.type === 'dividend') {
          totalUnits += u;
        } else if (tx.type === 'withdrawal') {
          totalUnits -= u;
        }
      }
    }

    // Position value = share price × units held
    const positionValue = totalUnits > 0 ? priceGBP * totalUnits : priceGBP;

    const { error: upsertError } = await serviceClient
      .from('investment_valuations')
      .upsert({
        user_id: user.id,
        investment_account_id,
        valuation_date: latestDate,
        value: positionValue,
        source: 'live',
      }, {
        onConflict: 'investment_account_id,valuation_date',
      });

    if (upsertError) {
      console.error('Upsert error:', upsertError);
    }

    const dailyChange = prevCloseGBP && totalUnits > 0
      ? { amount: (priceGBP - prevCloseGBP) * totalUnits, percentage: ((priceGBP - prevCloseGBP) / prevCloseGBP) * 100 }
      : prevCloseGBP
      ? { amount: priceGBP - prevCloseGBP, percentage: ((priceGBP - prevCloseGBP) / prevCloseGBP) * 100 }
      : null;

    return new Response(JSON.stringify({
      ticker,
      price: priceGBP,
      positionValue,
      totalUnits,
      previousClose: prevCloseGBP,
      date: latestDate,
      currency: 'GBP',
      dailyChange,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching ETF price:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
