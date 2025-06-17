import { Meme, Comment, User, MemeVote } from '../data/remote/Database.js';
import { Op } from 'sequelize';
import { database } from '../data/remote/Database.js';

export class MemeController {
  static async getMemesPage(
    page = 0,
    limit = 10,
    title = '',
    tags = [],
    sortedBy = 'createdAt',
    sortDirection = 'DESC',
    userId = null
  ) {
    const validatedPage = Math.max(0, parseInt(page) || 0);
    const validatedLimit = Math.min(Math.max(1, parseInt(limit) || 10), 50);
    const offset = validatedPage * validatedLimit;

    const normalizedTags = tags
      ? tags.map((tag) => tag.toLowerCase().trim()).filter(Boolean)
      : [];

    const orConditions = [];

    if (title && title.trim()) {
      orConditions.push({
        title: { [Op.iLike]: `%${title.trim()}%` },
      });
    }

    if (normalizedTags.length > 0) {
      orConditions.push({
        tags: { [Op.overlap]: normalizedTags },
      });
    }

    const where = orConditions.length > 0 ? { [Op.or]: orConditions } : {};

    const include = [];
    if (userId) {
      include.push({
        model: MemeVote,

        where: { UserId: userId },
        required: false, // così i meme senza voto vengono comunque inclusi
        attributes: ['isUpvote'],
      });
    }
    const memes = await Meme.findAll({
      where,
      limit: validatedLimit,
      offset: offset,
      order: [[sortedBy, sortDirection]],
      include,
    });

    return {
      data: memes,
      pagination: {
        page: validatedPage,
        limit: validatedLimit,
        hasMore: memes.length === validatedLimit,
      },
    };
  }

  static async getMemeById(
    id,
    commentsPage = 0,
    commentsLimit = 20,
    userId = null
  ) {
    if (!id) {
      throw { status: 400, message: 'Meme ID is required' };
    }

    const validatedCommentsPage = Math.max(0, parseInt(commentsPage) || 0);
    const validatedCommentsLimit = Math.min(
      Math.max(1, parseInt(commentsLimit) || 10),
      50
    );

    const commentsOffset = validatedCommentsPage * validatedCommentsLimit;
    const include = [];
    if (userId) {
      include.push({
        model: MemeVote,

        where: { UserId: userId },
        required: false, // così i meme senza voto vengono comunque inclusi
        attributes: ['isUpvote'],
      });
    }
    // Lancia le query in parallelo
    const [meme, comments, count] = await Promise.all([
      // Query 1: Dati del meme
      Meme.findByPk(id, {
        include,
      }),

      // Query 2: Commenti paginati
      Comment.findAll({
        where: {
          MemeId: id,
          parentId: null,
        },
        include: [
          {
            model: User,
            attributes: ['id', 'userName'],
          },
        ],
        order: [['createdAt', 'DESC']],
        limit: commentsLimit,
        offset: commentsOffset,
      }),
      Comment.count({
        where: {
          MemeId: id,
          parentId: null,
        },
      }),
    ]);

    if (!meme) {
      throw { status: 404, message: 'Meme not found' };
    }

    // Combina i risultati
    return {
      ...meme.toJSON(),
      comments: comments,
      commentsPagination: {
        page: commentsPage,
        limit: commentsLimit,
        totalCount: count,
      },
    };
  }

  static async voteMeme(memeId, usrId, isUpvote) {
    if (typeof isUpvote !== 'boolean') {
      throw { status: 400, message: 'isUpvote must be a boolean' };
    }
    if (!memeId || !usrId) {
      throw { status: 400, message: 'Meme ID and User ID are required' };
    }

    const meme = await Meme.findByPk(memeId, {
      include: [
        {
          model: MemeVote,
          where: { userId: usrId },
          required: false,
        },
      ],
    });
    if (!meme) {
      throw { status: 404, message: 'Meme not found' };
    }
    const t = await database.transaction();

    if (meme.MemeVotes && meme.MemeVotes.length === 1) {
      const existingVote = meme.MemeVotes[0];
      await existingVote.update({ isUpvote: isUpvote }, { transaction: t });
    } else {
      // Se non esiste un voto, creane uno nuovo
      await MemeVote.create(
        {
          memeId: memeId,
          userId: usrId,
          isUpvote: isUpvote,
        },
        { transaction: t }
      );
    }
    await t.commit();
    return await meme.reload(); // Ricarica il meme per aggiornare i voti
  }

  static async unvoteMeme(memeId, usrId) {
    if (!memeId || !usrId) {
      throw { status: 400, message: 'Meme ID and User ID are required' };
    }

    const meme = await Meme.findByPk(memeId, {
      include: [
        {
          model: MemeVote,
          where: { userId: usrId },
          required: false,
        },
      ],
    });
    if (!meme) {
      throw { status: 404, message: 'Meme not found' };
    }
    const t = await database.transaction();
    if (meme.MemeVotes && meme.MemeVotes.length === 1) {
      const vote = meme.MemeVotes[0];
      await vote.destroy({ transaction: t });
      await t.commit();
      return await meme.reload(); // Ricarica il meme per aggiornare i voti
    } else {
      await t.rollback();
      throw { status: 404, message: 'Vote not found for this user' };
    }
  }

  static async createMeme(
    { title, description, tags },
    fileName,
    originalName,
    filePath,
    userId
  ) {
    if (!title || !fileName || !originalName || !filePath || !userId) {
      throw { status: 400, message: 'Missing required fields' };
    }
    try {
      return Meme.create({
        title: title,
        description: description,
        tags: Array.isArray(tags) ? tags : [tags],
        fileName: fileName,
        originalName: originalName,
        filePath: filePath,
        UserId: userId,
      });
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

  static async updateMeme(id, memeData) {
    if (!id || !memeData) {
      throw { status: 400, message: 'Meme ID and data are required' };
    }

    const meme = await Meme.findByPk(id);
    if (!meme) {
      throw { status: 404, message: 'Meme not found' };
    }

    try {
      return await meme.update(memeData);
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

  static async deleteMeme(id) {
    if (!id) {
      throw { status: 400, message: 'Meme ID is required' };
    }

    const meme = await Meme.findByPk(id);
    if (!meme) {
      throw { status: 404, message: 'Meme not found' };
    }

    await meme.destroy();
    return { message: 'Meme deleted successfully' };
  }
}
