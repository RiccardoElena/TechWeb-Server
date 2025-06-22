import express from 'express';
import { AuthController } from '../controllers/AuthController.js';

export const authenticationRouter = express.Router();

/**
 * @swagger
 *  /auth/login:
 *    post:
 *      description: Authenticate user
 *      produces:
 *        - application/json
 *      requestBody:
 *        description: user credentials to authenticate
 *        required: true
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                userName:
 *                  type: string
 *                  example: Kyle
 *                password:
 *                  type: string
 *                  example: p4ssw0rd
 *      responses:
 *        200:
 *          description: User authenticated
 *          content:
 *            application/json:
 *              schema:
 *                type: string
 *                example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTUxNjIzOTAyMn0.KMUFsIDTnFmyG3nMiGM6H9FNFUROf3wh7SmqJp-QV30
 *        401:
 *          description: Invalid credentials
 */
authenticationRouter.post('/login', async (req, res) => {
  let userId = await AuthController.checkCredentials(req.body);

  res.json(AuthController.issueToken(userId, req.body.username));
});

/**
 * @swagger
 *  /auth/signup:
 *    post:
 *      description: Register a new user
 *      produces:
 *        - application/json
 *      requestBody:
 *        description: User information for registration
 *        required: true
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                userName:
 *                  type: string
 *                  example: Kyle
 *                password:
 *                  type: string
 *                  example: p4ssw0rd
 *      responses:
 *        201:
 *          description: User registered successfully
 *        400:
 *          description: Invalid user data
 *        409:
 *          description: Username already exists
 */
authenticationRouter.post('/signup', async (req, res) => {
  const user = await AuthController.register(
    req.body.username,
    req.body.password
  );

  res.status(201).json(AuthController.issueToken(user.id, user.userName));
});
