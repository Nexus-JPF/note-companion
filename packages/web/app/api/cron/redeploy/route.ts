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

          // Validate project ID format (Vercel project IDs must be lowercase, max 100 chars)
          const projectId = tokenRecord.projectId.trim().toLowerCase();
          if (projectId.length === 0 || projectId.length > 100) {
            console.error(
              `Invalid project ID for user ${tokenRecord.userId}: ${projectId} (length: ${projectId.length})`
            );
            return;
          }

          // Validate project ID doesn't contain invalid sequences
          if (projectId.includes('---')) {
            console.error(
              `Invalid project ID for user ${tokenRecord.userId}: contains '---' sequence`
            );
            return;
          }

          // Create new deployment
          const deployment = await vercel.deployments.createDeployment({
            requestBody: {
              name: `note-companion-redeploy-${Date.now()}`,
              target: 'production',
              project: projectId,
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
            `Redeployed project ${projectId} for user ${tokenRecord.userId}`
          );
          return deployment;
        } catch (error: any) {
          // Extract meaningful error message from various error types
          let errorMessage = 'Unknown error';
          let errorCode = 'unknown';
          let shouldLog = true;

          // Handle SDKValidationError (when Vercel returns unexpected error format)
          if (error?.name === 'SDKValidationError' || error?.rawValue) {
            const rawValue = error.rawValue || error.cause?.rawValue;
            if (rawValue?.error) {
              errorCode = rawValue.error.code || 'validation_error';
              errorMessage = rawValue.error.message || error.message || 'SDK validation failed';
              // Log the actual Vercel error, not the validation error
              console.error(
                `Failed to redeploy for user ${tokenRecord.userId}: Vercel API error [${errorCode}]: ${errorMessage}`
              );
              shouldLog = false; // Already logged above
            } else {
              errorMessage = error.message || 'SDK validation failed';
              errorCode = 'sdk_validation_error';
            }
          }
          // Handle SDKError (standard Vercel API errors)
          else if (error?.name === 'SDKError' || error?.statusCode) {
            errorCode = error.statusCode?.toString() || 'sdk_error';
            const body = error.body || error.rawResponse?.body;
            
            if (typeof body === 'string') {
              try {
                const parsed = JSON.parse(body);
                if (parsed.error) {
                  errorCode = parsed.error.code || errorCode;
                  errorMessage = parsed.error.message || error.message;
                }
              } catch {
                errorMessage = body || error.message;
              }
            } else if (body?.error) {
              errorCode = body.error.code || errorCode;
              errorMessage = body.error.message || error.message;
            } else {
              errorMessage = error.message || 'Vercel API error';
            }

            // Handle specific error codes
            if (error.statusCode === 403 || errorCode === 'forbidden') {
              errorMessage = `Invalid or expired Vercel token (403 Forbidden)`;
              // Optionally mark token as invalid in database
              console.warn(
                `Token for user ${tokenRecord.userId} appears to be invalid or expired`
              );
            }
          }
          // Handle other errors
          else {
            errorMessage = error?.message || String(error);
            errorCode = error?.code || 'unknown';
          }

          if (shouldLog) {
            console.error(
              `Failed to redeploy for user ${tokenRecord.userId}: [${errorCode}] ${errorMessage}`
            );
          }

          // Don't throw - Promise.allSettled will handle it
          return { error: errorMessage, code: errorCode };
        }
      })
    );

    const successful = results.filter((r) => r.status === 'fulfilled' && r.value !== undefined).length;
    const failed = results.filter((r) => r.status === 'rejected').length;
    const skipped = results.filter((r) => r.status === 'fulfilled' && r.value === undefined).length;

    // Categorize failures for better insights
    const failures = results
      .filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && r.value && 'error' in r.value))
      .map((r) => {
        if (r.status === 'rejected') {
          return { reason: r.reason?.message || 'Unknown error', code: 'rejected' };
        }
        if (r.value && 'error' in r.value) {
          return { reason: r.value.error, code: r.value.code || 'error' };
        }
        return null;
      })
      .filter(Boolean);

    const errorSummary = failures.reduce((acc, f) => {
      if (!f) return acc;
      const key = f.code || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('Redeploy cron job completed', {
      total: tokens.length,
      successful,
      failed,
      skipped,
      errorSummary,
    });

    return NextResponse.json({
      message: `Processed ${tokens.length} tokens`,
      stats: {
        total: tokens.length,
        successful,
        failed,
        skipped,
        errorSummary,
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
