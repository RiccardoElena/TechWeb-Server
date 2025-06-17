import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUI from 'swagger-ui-express';
import express from 'express';

const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: '3.1.0',
    info: {
      title: 'WebTech Memes Museum',
      version: '1.0.0',
    },
  },
  apis: ['./routes/*Router.js'], // files containing annotations
});

export const apiDocsRouter = express.Router();

apiDocsRouter.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerSpec));
