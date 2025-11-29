import { NextResponse } from 'next/server';
import { db, vercelTokens } from '@/drizzle/schema';
import { Vercel } from '@vercel/sdk';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  console.log('Redeploy cron job started');
  // Verify the request is from Vercel Cron
  const headersList = await headers();
  const authHeader = headersList.get('authorization');

  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    // Get all tokens from the database
    const tokens = await db.select().from(vercelTokens);

    console.log(`Found ${tokens.length} tokens to process`);

    const repo = 'note-companion';
    const org = 'Nexus-JPF';
    const ref = 'master';

    const results = await Promise.allSettled(
      tokens.map(async (tokenRecord) => {
        try {
          const vercel = new Vercel({
            bearerToken: tokenRecord.token,
          });

          if (!tokenRecord.projectId) {
            console.log(`No project ID for user ${tokenRecord.userId}`);
            return;
          }

          // Create new deployment
          const deployment = await vercel.deployments.createDeployment({
            requestBody: {
              name: `note-companion-redeploy-${Date.now()}`,
              target: 'production',
              project: tokenRecord.projectId,
              gitSource: {
                type: 'github',
                repo,
                ref,
                org,
              },
              projectSettings: {
                framework: 'nextjs',
                buildCommand: 'pnpm build:self-host',
                installCommand: 'pnpm install',
                outputDirectory: '.next',
                rootDirectory: 'packages/web',
              },
            },
          });

          // Update last deployment timestamp
          await db
            .update(vercelTokens)
            .set({
              lastDeployment: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(vercelTokens.userId, tokenRecord.userId));

          console.log(
            `Redeployed project ${tokenRecord.projectId} for user ${tokenRecord.userId}`
          );
          return deployment;
        } catch (error) {
          console.error(
            `Failed to redeploy for user ${tokenRecord.userId}:`,
            error
          );
          throw error;
        }
      })
    );

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return NextResponse.json({
      message: `Processed ${tokens.length} tokens`,
      stats: {
        total: tokens.length,
        successful,
        failed,
      },
    });
  } catch (error) {
    console.error('Error in redeploy cron:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
