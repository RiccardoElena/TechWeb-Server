import { Meme, Comment, User, MemeVote } from '../data/remote/Database.js';
import { Op } from 'sequelize';

export class MemeController {
  static async getMemesPage(
    page = 1,
    limit = 10,
    title = '',
    tags = [],
    sortedBy = 'createdAt',
    sortDirection = 'DESC'
  ) {
    const validatedPage = Math.max(1, parseInt(page) || 1);
    const validatedLimit = Math.min(Math.max(1, parseInt(limit) || 10), 50);
    const offset = (validatedPage - 1) * validatedLimit;

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

    const memes = await Meme.findAll({
      where,
      limit: validatedLimit,
      offset: offset,
      order: [[sortedBy, sortDirection]],
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

  static async getMemeById(id, commentsPage = 1, commentsLimit = 20) {
    if (!id) {
      throw { status: 400, message: 'Meme ID is required' };
    }

    const validatedCommentsPage = Math.max(1, parseInt(commentsPage) || 1);
    const validatedCommentsLimit = Math.min(
      Math.max(1, parseInt(commentsLimit) || 10),
      50
    );

    const commentsOffset = (validatedCommentsPage - 1) * validatedCommentsLimit;

    // Lancia le query in parallelo
    const [meme, comments] = await Promise.all([
      // Query 1: Dati del meme
      Meme.findByPk(id),

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
    ]);

    if (!meme) {
      return null;
    }

    // Combina i risultati
    return {
      ...meme.toJSON(),
      comments: comments,
      commentsPagination: {
        page: commentsPage,
        limit: commentsLimit,
        hasMore: comments.length === commentsLimit,
      },
    };
  }

  static async voteMeme(memeId, userId, isUpvote) {
    if (!memeId || !userId) {
      throw { status: 400, message: 'Meme ID and User ID are required' };
    }

    const meme = await Meme.findByPk(id, {
      include: [
        {
          model: MemeVote,
          where: { userId: userId }, // Filtra solo i voti di quell'utente
          required: false, // Così il meme viene trovato anche se non ci sono voti di quell'utente
        },
      ],
    });
    if (!meme) {
      throw { status: 404, message: 'Meme not found' };
    }

    if (meme.MemeVotes && meme.MemeVotes.length === 1) {
      const existingVote = meme.MemeVotes[0];
      Promise.all([
        existingVote.update({ voteType: isUpvote ? 'upvote' : 'downvote' }),
        meme.reload(), // Ricarica il meme per aggiornare i voti
      ]);
    }

    const existingVote = await MemeVote.findOne({
      where: { MemeId: memeId, UserId: userId },
    });

    if (existingVote) {
      // Se esiste già un voto, aggiorna il tipo di voto
      existingVote.voteType = isUpvote ? 'upvote' : 'downvote';
      return existingVote.save();
    } else {
      // Altrimenti crea un nuovo voto
      return MemeVote.create({
        MemeId: memeId,
        UserId: userId,
        voteType: isUpvote ? 'upvote' : 'downvote',
      });
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
