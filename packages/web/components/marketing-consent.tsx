'use client';

import * as React from 'react';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { getMarketingConsent, setMarketingConsent } from '@/app/actions';

type ConsentState = Awaited<ReturnType<typeof getMarketingConsent>>;

const CONSENT_TEXT =
  'Product updates: new features, launches and occasional offers. Unsubscribe anytime.';

function useMarketingConsent() {
  const [state, setState] = React.useState<ConsentState>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    getMarketingConsent()
      .then((s) => {
        if (!cancelled) setState(s);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async (optIn: boolean) => {
    setSaving(true);
    setError(false);
    const { success } = await setMarketingConsent(optIn);
    setSaving(false);
    if (success) setState({ decided: true, optedIn: optIn });
    else setError(true);
  };

  return { state, loaded, saving, error, save };
}

// Shown on the dashboard until the user answers once. Nothing is pre-selected:
// consent only counts when the user clicks yes.
export function MarketingConsentPrompt() {
  const { state, saving, error, save } = useMarketingConsent();
  if (!state || state.decided) return null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-violet-100 bg-violet-50 p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-3">
        <Mail className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
        <div>
          <p className="font-medium">Want product updates by email?</p>
          <p className="text-sm text-muted-foreground">{CONSENT_TEXT}</p>
          {error && (
            <p className="text-sm text-red-600">
              Could not save your choice. Please try again.
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={saving}
          onClick={() => void save(false)}
        >
          No thanks
        </Button>
        <Button size="sm" disabled={saving} onClick={() => void save(true)}>
          Yes, send me updates
        </Button>
      </div>
    </div>
  );
}

// Settings toggle: lets the user change their answer at any time.
export function MarketingConsentToggle() {
  const { state, loaded, saving, error, save } = useMarketingConsent();

  if (!loaded) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (!state) {
    return (
      <p className="text-sm text-muted-foreground">
        Email preferences are unavailable right now.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <label className="flex items-center justify-between gap-4">
        <span className="text-sm">{CONSENT_TEXT}</span>
        <Switch
          checked={state.optedIn}
          disabled={saving}
          onCheckedChange={(checked) => void save(checked)}
          aria-label="Receive product update emails"
        />
      </label>
      <p className="text-xs text-muted-foreground">
        Account emails (receipts, payment issues) and getting-started tips are
        sent either way. Stop the tips with the unsubscribe link in any email.
      </p>
      {error && (
        <p className="text-sm text-red-600">
          Could not save your choice. Please try again.
        </p>
      )}
    </div>
  );
}
