import {
  Meme,
  Comment,
  User,
  CommentVote,
  database,
} from '../data/remote/Database.js';

export class CommentController {
  static async getChildrenComments(
    commentId,
    page = 0,
    limit = 10,
    userId = null
  ) {
    const validatedPage = Math.max(0, parseInt(page) || 0);
    const validatedLimit = Math.min(Math.max(1, parseInt(limit) || 10), 50);
    const offset = validatedPage * validatedLimit;

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
        where: { userId: userId },
        required: false, // Include comments even if the user hasn't voted
        attributes: ['isUpvote'],
      });
    }

    const [parent, replies, count] = await Promise.all([
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
      data: { parent, replies },
      pagination: {
        page: validatedPage,
        limit: validatedLimit,
        totalCount: count,
      },
    };
  }

  static async createComment(memeId, userId, content, parentId = null) {
    if (!memeId || !userId || !content) {
      throw {
        status: 400,
        message: 'Meme ID, User ID, and content are required',
      };
    }
    const t = await database.transaction();
    const newComment = await Comment.create(
      {
        MemeId: memeId,
        UserId: userId,
        content,
        parentId,
      },
      { transaction: t }
    );

    await t.commit();
    return newComment;
  }

  static async voteComment(commentId, userId, isUpvote) {
    if (typeof isUpvote !== 'boolean') {
      throw { status: 400, message: 'isUpvote must be a boolean' };
    }
    if (!commentId || !userId) {
      throw { status: 400, message: 'Comment ID and User ID are required' };
    }

    const comment = await Comment.findByPk(commentId, {
      include: [
        {
          model: User,
          attributes: ['id', 'userName'],
        },
        {
          model: CommentVote,
          where: { userId: userId },
          required: false,
        },
      ],
    });

    if (!comment) {
      throw { status: 404, message: 'Comment not found' };
    }

    const t = await database.transaction();
    if (comment.CommentVotes && comment.CommentVotes.length === 1) {
      const existingVote = comment.CommentVotes[0];
      await existingVote.update({ isUpvote: isUpvote }, { transaction: t });
    } else {
      // Se non esiste un voto, creane uno nuovo
      await CommentVote.create(
        {
          commentId: commentId,
          userId: userId,
          isUpvote: isUpvote,
        },
        { transaction: t }
      );
    }
    await t.commit();
    return await comment.reload();
  }

  static async unvoteComment(commentId, usrId) {
    if (!commentId || !usrId) {
      throw { status: 400, message: 'Comment ID and User ID are required' };
    }

    const comment = await Comment.findByPk(commentId, {
      include: [
        {
          model: User,
          attributes: ['id', 'userName'],
        },
        {
          model: CommentVote,
          where: { userId: usrId },
          required: false,
        },
      ],
    });
    if (!comment) {
      throw { status: 404, message: 'Comment not found' };
    }

    const t = await database.transaction();
    if (comment.CommentVotes && comment.CommentVotes.length === 1) {
      const vote = comment.CommentVotes[0];
      await vote.destroy({ transaction: t });
      await t.commit();
      return await comment.reload(); // Ricarica il commento per aggiornare i voti
    } else {
      await t.rollback();
      throw { status: 404, message: 'Vote not found for this user' };
    }
  }

  static async updateComment(commentId, userId, content) {
    if (!commentId || !userId || !content) {
      throw {
        status: 400,
        message: 'Comment ID, User ID, and content are required',
      };
    }

    const comment = await Comment.findByPk(commentId, {
      include: [
        {
          model: User,
          attributes: ['id', 'userName'],
        },
        {
          model: CommentVote,
          where: { userId: userId },
          required: false, // Include comment even if the user hasn't voted
          attributes: ['isUpvote'],
        },
      ],
    });
    if (!comment) {
      throw { status: 404, message: 'Comment not found' };
    }

    // Check if the user is the owner of the comment
    if (comment.UserId !== userId) {
      throw {
        status: 403,
        message:
          'Forbidden! You do not have permissions to modify this resource',
      };
    }

    // Update the comment content
    try {
      return await comment.update({ content });
    } catch (err) {
      if (
        err.name === 'SequelizeValidationError' ||
        err.name === 'SequelizeUniqueConstraintError'
      ) {
        throw { status: 400, message: 'Data validation error' };
      }
      throw err; // rilancia altri errori non previsti
    }
  }

  static async deleteComment(commentId, userId) {
    if (!commentId || !userId) {
      throw { status: 400, message: 'Comment ID and User ID are required' };
    }

    const comment = await Comment.findByPk(commentId);
    if (!comment) {
      throw { status: 404, message: 'Comment not found' };
    }
    const t = await database.transaction();
    await comment.destroy({ transaction: t });
    await t.commit();
    return { message: 'Comment deleted successfully' };
  }
}
