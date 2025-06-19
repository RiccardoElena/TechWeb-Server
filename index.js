import express from 'express';
import morgan from 'morgan';
import cors from 'cors';

import { authenticationRouter } from './routes/authenticationRouter.js';
import { errorHandler } from './middleware/errors/errorHandler.js';
import { apiDocsRouter } from './routes/apiDocsRouter.js';
import { memeOpenRouter, memeRestrictedRouter } from './routes/memeRouter.js';
import {
  enforceAuthentication,
  extractUserId,
} from './middleware/utils/authorization.js';
import {
  commentOpenRouter,
  commentRestrictedRouter,
} from './routes/commentRouter.js';
import 'dotenv/config.js';

const app = express();
const PORT = process.env.PORT;

app.use(morgan('dev'));

app.use(cors());

app.use(express.json());

app.use('/uploads', express.static('uploads'));

app.use(apiDocsRouter);

// Importing the authentication router
app.use('/auth', authenticationRouter);
app.use(extractUserId);
app.use('/memes', memeOpenRouter);
app.use('/memes/:memeId/comments', commentOpenRouter);
app.use(enforceAuthentication);
app.use('/memes', memeRestrictedRouter);
app.use('/memes/:memeId/comments', commentRestrictedRouter);

app.use(errorHandler);
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
