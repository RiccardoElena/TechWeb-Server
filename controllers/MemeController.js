import {
  Meme,
  Comment,
  User,
  MemeVote,
  MemeOfTheDay,
  CommentVote,
} from '../data/remote/Database.js';
import { Op } from 'sequelize';
import { database } from '../data/remote/Database.js';
import fs from 'fs/promises';
import path from 'path';

export class MemeController {
  static async getMemesPage(
    page = 0,
    limit = 10,
    title = '',
    tags = [],
    sortedBy = 'createdAt',
    sortDirection = 'DESC',
    byUser = null,
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

    const where = {};
    if (byUser) {
      where.userId = byUser;
    }
    if (orConditions.length > 0) {
      where[Op.or] = orConditions;
    }

    const include = [
      {
        model: User,
        attributes: ['id', 'userName'],
        required: true, // Assicura che il meme abbia un utente associato
      },
    ];
    if (userId) {
      include.push({
        model: MemeVote,
        where: { userId: userId },
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

    memes.forEach((meme) => {
      console.log(meme.toJSON());
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
    const includeMeme = [
      {
        model: User,
        attributes: ['id', 'userName'],
        required: true, // Assicura che il meme abbia un utente associato
      },
    ];
    const includeComment = [...includeMeme];
    if (userId) {
      includeMeme.push({
        model: MemeVote,
        where: { userId: userId },
        required: false, // così i meme senza voto vengono comunque inclusi
        attributes: ['isUpvote'],
      });

      includeComment.push({
        model: CommentVote,
        where: { userId: userId },
        required: false, // così i meme senza voto vengono comunque inclusi
        attributes: ['isUpvote'],
      });
    }
    // Lancia le query in parallelo
    const [meme, comments, count] = await Promise.all([
      // Query 1: Dati del meme
      Meme.findByPk(id, {
        include: includeMeme,
      }),

      // Query 2: Commenti paginati
      Comment.findAll({
        where: {
          MemeId: id,
          parentId: null,
        },
        include: [
          ...includeComment,
          {
            model: User,
            attributes: ['userName'],
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

  static async getMemeOfTheDayId() {
    const today = new Date();
    console.log('Getting meme of the day for:', today);
    today.setHours(0, 0, 0, 0);
    console.log('Today:', today);

    const memeOfTheDay = await MemeOfTheDay.findOne({
      where: {
        createdAt: {
          [Op.gte]: today,
        },
      },
    });

    if (memeOfTheDay) {
      console.log('Meme of the day found:', memeOfTheDay.MemeId);
      return memeOfTheDay.MemeId;
    }
    console.log('No meme of the day found for today, calculating...');

    const memes = await Meme.findAll({
      where: {
        createdAt: {
          [Op.lte]: today,
        },
      },
      attributes: ['id'],
    });

    if (!memes || memes.length === 0) {
      throw { status: 404, message: 'No memes found' };
    }

    // Calcola un numero di giorni dal 1/1/1970
    const dayNumber = Math.floor(today.getTime() / (1000 * 60 * 60 * 24));
    const index = dayNumber % memes.length;
    console.log(index);

    const memeId = memes[index] ? memes[index].id : null;
    if (!memeId) {
      throw { status: 404, message: 'Meme not found' };
    }
    console.log(memeId);
    // Crea o aggiorna il meme of the day
    await MemeOfTheDay.create({
      MemeId: memeId,
    });

    return memeId;
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
    filePath,
    userId
  ) {
    if (!title || !fileName || !filePath || !userId) {
      throw { status: 400, message: 'Missing required fields' };
    }
    try {
      console.log('Creating meme with data:');
      return await Meme.create({
        title: title,
        description: description,
        tags: Array.isArray(tags) ? tags : [tags],
        fileName: fileName,
        filePath: filePath,
        UserId: userId,
      });
    } catch (err) {
      console.log('Error creating meme:', err.name);
      if (
        err.name === 'SequelizeValidationError' ||
        err.name === 'SequelizeUniqueConstraintError'
      ) {
        throw { status: 400, message: 'Data validation error' };
      }
      if (err.name === 'SequelizeForeignKeyConstraintError') {
        throw { status: 409, message: 'User not found' };
      }
      throw err; // rilancia altri errori non previsti
    }
  }

  static async updateMeme(id, memeData, userId) {
    if (!id || !memeData) {
      throw { status: 400, message: 'Meme ID and data are required' };
    }

    const meme = await Meme.findByPk(id, {
      include: [
        {
          model: MemeVote,
          where: { userId: userId },
          required: false, // così i meme senza voto vengono comunque inclusi
          attributes: ['isUpvote'],
        },
      ],
    });
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

    if (meme.filePath) {
      const uploadsDir = path.resolve('uploads');
      const fileToDelete = path.resolve(
        uploadsDir,
        path.basename(meme.filePath)
      );
      try {
        await fs.unlink(fileToDelete);
      } catch (err) {
        // Ignora l'errore se il file non esiste
        if (err.code !== 'ENOENT') {
          throw err;
        }
      }
    }

    await meme.destroy();
    return { message: 'Meme deleted successfully' };
  }
}
