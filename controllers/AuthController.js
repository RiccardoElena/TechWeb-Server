import { User, Meme, Comment } from '../data/remote/Database.js';
import { createHash, randomBytes } from 'crypto';
import Jwt from 'jsonwebtoken';

export class AuthController {
  static async checkCredentials(user) {
    const foundUser = await User.findOne({
      where: { userName: user.username },
      attributes: ['id', 'userName', 'password', 'salt'],
      raw: true,
      logging: false,
    });

    if (!foundUser) {
      throw { status: 401, message: 'Invalid credentials' };
    }

    // Hash the provided password with the found user's salt
    const hash = createHash('sha256');
    hash.update(user.password + foundUser.salt);
    const hashedPassword = hash.digest('hex');

    if (hashedPassword !== foundUser.password) {
      throw { status: 401, message: 'Invalid credentials' };
    }

    return foundUser.id;
  }

  static async register(userName, password) {
    if (!userName || !password) {
      throw { status: 400, message: 'Username and password are required' };
    }

    try {
      return await User.create({
        userName,
        salt: randomBytes(2).toString('hex'),
        password: password,
      });
    } catch (err) {
      console.error('Error creating user:', err);
      if (err.name === 'SequelizeUniqueConstraintError') {
        throw { status: 409, message: 'Username already exists' };
      } else {
        throw { status: 500, message: 'Error creating user' };
      }
    }
  }

  static issueToken(userId, userName) {
    return Jwt.sign(
      { userId: userId, userName: userName },
      process.env.TOKEN_SECRET,
      {
        expiresIn: `${24 * 60 * 60}s`,
      }
    );
  }

  static isTokenValid(token, callback) {
    Jwt.verify(token, process.env.TOKEN_SECRET, callback);
  }

  static async checkMemePermissions(userId, memeId) {
    if (!userId || !memeId) {
      throw { status: 400, message: 'User ID and Meme ID are required' };
    }

    const meme = await Meme.findByPk(memeId, {
      attributes: ['UserId'],
      raw: true,
    });
    if (!meme) {
      throw { status: 404, message: 'Meme not found' };
    }

    if (meme.UserId !== userId) {
      throw {
        status: 403,
        message:
          'Forbidden! You do not have permissions to view or modify this resource',
      };
    }
  }

  static async checkCommentPermissions(userId, commentId) {
    if (!userId || !commentId) {
      throw { status: 400, message: 'User ID and Comment ID are required' };
    }

    const comment = await Comment.findByPk(commentId, {
      attributes: ['UserId'],
      raw: true,
    });
    if (!comment) {
      throw { status: 404, message: 'Comment not found' };
    }

    if (comment.UserId !== userId) {
      throw {
        status: 403,
        message:
          'Forbidden! You do not have permissions to view or modify this resource',
      };
    }
  }
}
