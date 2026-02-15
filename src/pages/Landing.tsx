import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Brain,
  CalendarDays,
  ShoppingCart,
  Target,
  PiggyBank,
  Sparkles,
  ChefHat,
} from 'lucide-react';

const features = [
  {
    icon: Brain,
    title: 'AI-Powered Portion Optimisation',
    description:
      'Our algorithm adjusts every ingredient to hit your exact calorie and macro targets — no guesswork required.',
  },
  {
    icon: CalendarDays,
    title: 'Weekly Meal Planning',
    description:
      'Plan your whole week with built-in calorie cycling and zigzag support to keep your metabolism firing.',
  },
  {
    icon: ShoppingCart,
    title: 'Auto-Generated Grocery Lists',
    description:
      'One tap turns your meal plan into a consolidated shopping list, grouped by retailer.',
  },
  {
    icon: Target,
    title: 'Daily Nutrition Tracking',
    description:
      'Track calories, protein, carbs and fat against personalised daily targets at a glance.',
  },
  {
    icon: PiggyBank,
    title: 'Budget-Friendly Meals',
    description:
      'Hit your macros without blowing your budget — smart suggestions that respect your wallet.',
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ─── Nav ─── */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <ChefHat className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground tracking-tight">
              LifeHub
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Button disabled size="sm" className="opacity-60">
                Create Account
              </Button>
              <Badge
                variant="secondary"
                className="absolute -top-2 -right-2 text-[10px] px-1.5 py-0 pointer-events-none"
              >
                Soon
              </Badge>
            </div>
            <Link
              to="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Admin
            </Link>
          </div>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-background" />
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-[400px] w-[400px] rounded-full bg-accent/5 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-32 text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground mb-6">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            AI-optimised meal planning
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1]">
            Hit Your Macros,
            <br />
            <span className="text-primary">Every Single Day</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base sm:text-lg text-muted-foreground leading-relaxed">
            LifeHub uses AI to optimise your food portions so every meal fits
            your exact calorie and macro targets — then turns your plan into a
            ready-to-shop grocery list.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <div className="relative">
              <Button disabled size="lg" className="opacity-60 px-8">
                Get Started
              </Button>
              <Badge
                variant="secondary"
                className="absolute -top-2 -right-2 text-[10px] px-1.5 py-0 pointer-events-none"
              >
                Coming Soon
              </Badge>
            </div>
            <Button variant="outline" size="lg" asChild>
              <Link to="/login">Sign in as Admin</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24">
        <h2 className="text-center text-2xl sm:text-3xl font-bold text-foreground">
          Everything you need to nail your nutrition
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-center text-muted-foreground">
          Plan smarter, eat better, spend less — powered by intelligent
          automation.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card
              key={f.title}
              className="group border border-border hover:border-primary/30 transition-colors"
            >
              <CardContent className="p-6 flex flex-col gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {f.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="mt-auto border-t border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} LifeHub. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
