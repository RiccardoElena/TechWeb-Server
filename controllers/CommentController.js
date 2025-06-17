import { Meme, Comment, User, CommentVote } from '../data/remote/Database.js';

export class CommentController {
  static async getComments(commentId, page = 1, limit = 10, userId = null) {
    const validatedPage = Math.max(1, parseInt(page) || 1);
    const validatedLimit = Math.min(Math.max(1, parseInt(limit) || 10), 50);
    const offset = (validatedPage - 1) * validatedLimit;

    if (!commentId) {
      throw { status: 400, message: 'Comment ID is required' };
    }

    const include = [
      {
        model: User,
        attributes: ['id', 'userName'],
      },
    ];

    if (userId) {
      include.push({
        model: CommentVote,
        where: { UserId: userId },
        required: false, // Include comments even if the user hasn't voted
        attributes: ['isUpvote'],
      });
    }

    const [parent, children, count] = await Promise.all([
      Comment.findByPk(commentId, { include }),
      Comment.findAll({
        where: { parentId: commentId },
        limit: validatedLimit,
        offset: offset,
        order: [['createdAt', 'DESC']],
        include,
      }),
      Comment.count({ where: { parentId: commentId } }),
    ]);

    if (!parent) {
      throw { status: 404, message: 'Parent comment not found' };
    }

    return {
      data: { parent, children },
      pagination: {
        page: validatedPage,
        limit: validatedLimit,
        totalCount: count,
      },
    };
  }
}
