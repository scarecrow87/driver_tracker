/**
 * Next.js instrumentation hook – runs once when the server starts.
 * We use it to kick off the background cron job.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startCronJob } = await import('./lib/cron');
    startCronJob();
  }
}
