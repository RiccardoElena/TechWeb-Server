import { AuthController } from '../../controllers/AuthController.js';

function setUserId(req, userId, next) {
  req.userId = userId;

  next();
}

export function extractUserId(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.split(' ')[1];
  if (!token) {
    setUserId(req, null, next);
  } else {
    AuthController.isTokenValid(token, (err, decodedToken) => {
      if (err) {
        setUserId(req, null, next);
      } else {
        setUserId(req, decodedToken.userId, next);
      }
    });
  }
}

export function enforceAuthentication(req, res, next) {
  console.log('enforceAuthentication middleware');
  if (!req.userId) {
    throw { status: 401, message: 'Unauthorized' };
  }
  next();
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

export async function checkCommentAuthorization(req, res, next) {
  const user = req.userId;
  const commentId = req.params.id;
  if (!commentId) {
    throw { status: 400, message: 'Comment ID is required' };
  }

  await AuthController.checkCommentPermissions(user, commentId);
  next();
}
