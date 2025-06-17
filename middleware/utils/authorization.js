import { AuthController } from '../../controllers/AuthController.js';

export function enforceAuthentication(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];
  if (!token) {
    throw { status: 401, message: 'Unauthorized' };
  }

  AuthController.isTokenValid(token, (err, decodedToken) => {
    console.log('Decoded token:', decodedToken);

    if (err) {
      throw { status: 401, message: 'Unauthorized' };
    }
    req.userId = decodedToken.userId;
    console.log('User ID from token:', req.userId);
    next();
  });
}

export async function checkMemeAuthorization(req, res, next) {
  const user = req.userId;
  const memeId = req.params.id;
  if (!memeId) {
    throw { status: 400, message: 'Meme ID is required' };
  }

  await AuthController.checkMemePermissions(user, memeId);
  next();
}
