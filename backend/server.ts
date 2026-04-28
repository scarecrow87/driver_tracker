import * as express from 'express';
import locationRoutes from './routes/locationRoutes';

const app = express();
app.use(express.json());

// Session middleware placeholder (implement as needed)
app.use((req, res, next) => {
  (req as any).session = (req as any).session || {};
  next();
});

app.use('/api/locations', locationRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
