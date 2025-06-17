import express from 'express';
import morgan from 'morgan';
import cors from 'cors';

import { authenticationRouter } from './routes/authenticationRouter.js';
import { errorHandler } from './middleware/errors/errorHandler.js';
import { apiDocsRouter } from './routes/apiDocsRouter.js';
import { memeOpenRouter, memeRestrictedRouter } from './routes/memeRouter.js';
import { enforceAuthentication } from './middleware/utils/authorization.js';

const app = express();
const PORT = 3000;

app.use(morgan('dev'));

app.use(cors());

app.use(express.json());

app.use('/public', express.static('public'));

app.use(apiDocsRouter);

// Importing the authentication router
app.use('/auth', authenticationRouter);
app.use('/memes', memeOpenRouter);
app.use(enforceAuthentication);
app.use('/memes', memeRestrictedRouter);

app.use(errorHandler);
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
