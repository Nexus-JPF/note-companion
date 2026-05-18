import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Link } from '@/components/ui/link';

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic';

export default function TopUpCancelled() {
  return (
    <div className="container mx-auto max-w-2xl mt-20 px-4">
      <Card className="p-6">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-amber-600">
            Top-up Cancelled
          </h1>
          <p className="text-gray-600">
            Your top-up was cancelled. No charges were made to your account.
          </p>

          <div className="flex flex-col gap-4 mt-8">
            <Button asChild>
              <Link href="/dashboard" className="w-full">
                Return to Dashboard
              </Link>
            </Button>

            <Button variant="outline" asChild>
              <Link href="/pricing" className="w-full">
                View Pricing Options
              </Link>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
