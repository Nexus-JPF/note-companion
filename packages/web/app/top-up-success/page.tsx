import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Link } from '@/components/ui/link';

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic';

export default function TopUpSuccess() {
  return (
    <div className="container mx-auto max-w-2xl mt-20 px-4">
      <Card className="p-6">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-green-600">
            Top-up Successful!
          </h1>
          <p className="text-gray-600">
            Your credits have been added to your account successfully.
          </p>

          <div className="flex flex-col gap-4 mt-8">
            <Button asChild>
              <Link href="obsidian://open" className="w-full">
                You can now go back to Obsidian and use Note Companion.
              </Link>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
