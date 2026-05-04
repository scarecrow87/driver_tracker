import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import pg from 'pg';
import locationRoutes from './routes/locationRoutes';
import authRoutes from './routes/authRoutes';
import checkinRoutes from './routes/checkinRoutes';
import checkinsRoutes from './routes/checkinsRoutes';
import usersRoutes from './routes/usersRoutes';
import statsRoutes from './routes/statsRoutes';
import smsRoutes from './routes/smsRoutes';
import settingsRoutes from './routes/settingsRoutes';
import webhookRoutes from './routes/webhookRoutes';
import pushRoutes from './routes/pushRoutes';
import { startCronJob } from './lib/cron';

const app = express();
const readinessPool = process.env.DATABASE_URL
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL })
  : null;

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Needed for Twilio webhook form data

// Health endpoints are intentionally registered before API rate limiting.
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/ready', async (_req, res) => {
  if (!readinessPool) {
    return res.status(503).json({
      status: 'not_ready',
      error: 'DATABASE_URL is not configured',
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const result = await readinessPool.query(
      `
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'NotificationSettings'
          AND column_name = 'inboundSmsEnabled'
        LIMIT 1
      `
    );

    if (result.rowCount !== 1) {
      return res.status(503).json({
        status: 'not_ready',
        error:
          'Database schema is missing NotificationSettings.inboundSmsEnabled. Run prisma migrate deploy.',
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      status: 'ready',
      database: 'ok',
      schema: 'ok',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Readiness check failed:', error);
    return res.status(503).json({
      status: 'not_ready',
      error: 'Database readiness check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// Rate limiting (100 requests per 15 minutes per IP)
app.use(
  '/api/',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again later.',
  })
);

// Routes
app.use('/api/locations', locationRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/checkin', checkinRoutes);
app.use('/api/checkins', checkinsRoutes);
app.use('/api/admin/users', usersRoutes);
app.use('/api/admin/stats', statsRoutes);
app.use('/api/admin/sms', smsRoutes);
app.use('/api/admin/settings', settingsRoutes);
app.use('/api/push', pushRoutes);
app.use('/api', webhookRoutes);

// Global error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start cron job for alert escalation (if not in test mode)
if (process.env.NODE_ENV !== 'test') {
  startCronJob();
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
