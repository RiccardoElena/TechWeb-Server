import { Sequelize } from 'sequelize';
import { createModel as createCommentModel } from './models/Comment.js';
import { createModel as createCommentVoteModel } from './models/CommentVote.js';
import { createModel as createMemeModel } from './models/Meme.js';
import { createModel as createMemeVoteModel } from './models/MemeVote.js';
import { createModel as createUserModel } from './models/User.js';
import { createModel as createMemeOfTheDayModel } from './models/MemeOfTheDay.js';

import 'dotenv/config.js';

export const database = new Sequelize(process.env.DB_CONNECTION_URI, {
  dialect: process.env.DIALECT,
});

createCommentModel(database);
createCommentVoteModel(database);
createMemeModel(database);
createMemeVoteModel(database);
createUserModel(database);
createMemeOfTheDayModel(database);

export const { User, Meme, MemeVote, Comment, CommentVote, Tag, MemeOfTheDay } =
  database.models;

createModelAssociations();

setUpTriggers();

database
  .sync() // Uncomment this line to alter the tables automatically
  .then(() => {})
  .catch((err) => {
    console.error(
      'Error with database synchronization: ' + err.message,
      err.stack
    );
  });

function setUpTriggers() {
  MemeVote.addHook('afterCreate', async (memeVote, options) => {
    const meme = await Meme.findByPk(memeVote.memeId, {
      transaction: options.transaction,
    });

    if (memeVote.isUpvote) {
      await meme.increment('upvotesNumber', {
        transaction: options.transaction,
      });
    } else {
      await meme.increment('downvotesNumber', {
        transaction: options.transaction,
      });
    }
  });

  MemeVote.addHook('afterUpdate', async (memeVote, options) => {
    const meme = await Meme.findByPk(memeVote.memeId, {
      transaction: options.transaction,
    });
    if (memeVote.previous('isUpvote') && !memeVote.isUpvote) {
      await Promise.all([
        meme.decrement('upvotesNumber', {
          transaction: options.transaction,
        }),
        meme.increment('downvotesNumber', {
          transaction: options.transaction,
        }),
      ]);
    } else if (!memeVote.previous('isUpvote') && memeVote.isUpvote) {
      await Promise.all([
        meme.increment('upvotesNumber', {
          transaction: options.transaction,
        }),
        meme.decrement('downvotesNumber', {
          transaction: options.transaction,
        }),
      ]);
    }
  });

  MemeVote.addHook('afterDestroy', async (memeVote, options) => {
    const meme = await Meme.findByPk(memeVote.memeId, {
      transaction: options.transaction,
    });
    if (memeVote.isUpvote) {
      await meme.decrement('upvotesNumber', {
        transaction: options.transaction,
      });
    } else {
      await meme.decrement('downvotesNumber', {
        transaction: options.transaction,
      });
    }
  });

  CommentVote.addHook('afterCreate', async (commentVote, options) => {
    const comment = await Comment.findByPk(commentVote.commentId, {
      transaction: options.transaction,
    });

    if (commentVote.isUpvote) {
      await comment.increment('upvotesNumber', {
        transaction: options.transaction,
      });
    } else {
      await comment.increment('downvotesNumber', {
        transaction: options.transaction,
      });
    }
  });

  CommentVote.addHook('afterUpdate', async (commentVote, options) => {
    const comment = await Comment.findByPk(commentVote.commentId, {
      transaction: options.transaction,
    });
    if (commentVote.previous('isUpvote') && !commentVote.isUpvote) {
      await Promise.all([
        comment.decrement('upvotesNumber', {
          transaction: options.transaction,
        }),
        comment.increment('downvotesNumber', {
          transaction: options.transaction,
        }),
      ]);
    } else if (!commentVote.previous('isUpvote') && commentVote.isUpvote) {
      await Promise.all([
        comment.increment('upvotesNumber', {
          transaction: options.transaction,
        }),
        comment.decrement('downvotesNumber', {
          transaction: options.transaction,
        }),
      ]);
    }
  });

  CommentVote.addHook('afterDestroy', async (commentVote, options) => {
    const comment = await Comment.findByPk(commentVote.commentId, {
      transaction: options.transaction,
    });
    if (commentVote.isUpvote) {
      await comment.decrement('upvotesNumber', {
        transaction: options.transaction,
      });
    } else {
      await comment.decrement('downvotesNumber', {
        transaction: options.transaction,
      });
    }
  });

  Comment.addHook('afterCreate', async (comment, options) => {
    if (!comment.parentId) {
      const meme = await Meme.findByPk(comment.MemeId, {
        transaction: options.transaction,
      });
      if (!meme) {
        throw { status: 404, message: 'Meme not found' };
      }

      await meme.increment('commentsNumber', {
        transaction: options.transaction,
      });
    } else {
      const parentComment = await Comment.findByPk(comment.parentId, {
        transaction: options.transaction,
      });
      if (!parentComment) {
        throw { status: 404, message: 'Parent comment not found' };
      }
      await parentComment.increment('commentsNumber', {
        transaction: options.transaction,
      });
    }
  });

  Comment.addHook('afterDestroy', async (comment, options) => {
    if (comment.parentId) {
      const parentComment = await Comment.findByPk(comment.parentId, {
        transaction: options.transaction,
      });
      if (!parentComment) {
        throw { status: 404, message: 'Parent comment not found' };
      }
      await parentComment.decrement('commentsNumber', {
        transaction: options.transaction,
      });
    } else {
      const meme = await Meme.findByPk(comment.MemeId, {
        transaction: options.transaction,
      });
      if (!meme) {
        throw { status: 404, message: 'Meme not found' };
      }
      await meme.decrement('commentsNumber', {
        transaction: options.transaction,
      });
    }
  });
}

function createModelAssociations() {
  // User-Meme 1:N
  Meme.User = Meme.belongsTo(User, {
    foreignKey: { allowNull: false, onDelete: 'CASCADE' },
  });
  User.Memes = User.hasMany(Meme, {
    foreignKey: { allowNull: false, onDelete: 'CASCADE' },
  });

  // Meme-MemeVote 1:N
  Meme.Votes = Meme.hasMany(MemeVote, {
    foreignKey: 'memeId',
    onDelete: 'CASCADE',
  });
  MemeVote.Meme = MemeVote.belongsTo(Meme, {
    foreignKey: 'memeId',
    onDelete: 'CASCADE',
  });

  // User-MemeVote 1:N
  MemeVote.User = MemeVote.belongsTo(User, {
    foreignKey: 'userId',
    onDelete: 'CASCADE',
  });
  User.MemeVotes = User.hasMany(MemeVote, {
    foreignKey: 'userId',
    onDelete: 'CASCADE',
  });

  // User-Comment 1:N
  Comment.User = Comment.belongsTo(User, {
    foreignKey: { allowNull: false, onDelete: 'CASCADE' },
  });
  User.Comments = User.hasMany(Comment, {
    foreignKey: { allowNull: false, onDelete: 'CASCADE' },
  });

  // Meme-Comment 1:N
  Meme.Comments = Meme.hasMany(Comment, {
    foreignKey: { allowNull: false, onDelete: 'CASCADE' },
  });
  Comment.Meme = Comment.belongsTo(Meme, {
    foreignKey: { allowNull: false, onDelete: 'CASCADE' },
  });

  // Comment-CommentVote 1:N
  Comment.Votes = Comment.hasMany(CommentVote, {
    foreignKey: 'commentId',
    onDelete: 'CASCADE',
  });
  CommentVote.Comment = CommentVote.belongsTo(Comment, {
    foreignKey: 'commentId',
    onDelete: 'CASCADE',
  });

  // User-CommentVote 1:N
  CommentVote.User = CommentVote.belongsTo(User, {
    foreignKey: 'userId',
    onDelete: 'CASCADE',
  });
  User.CommentVotes = User.hasMany(CommentVote, {
    foreignKey: 'userId',
    onDelete: 'CASCADE',
  });

  // Comment-Comment 1:M
  Comment.Parent = Comment.belongsTo(Comment, {
    foreignKey: 'parentId',
    onDelete: 'CASCADE',
  });
  Comment.Children = Comment.hasMany(Comment, {
    foreignKey: 'parentId',
    onDelete: 'CASCADE',
  });

  // MemeOfTheDay-Meme 1:1
  MemeOfTheDay.Meme = MemeOfTheDay.belongsTo(Meme, {
    foreignKey: { allowNull: false },
    onDelete: 'CASCADE',
  });
  Meme.MemeOfTheDay = Meme.hasOne(MemeOfTheDay, {
    foreignKey: { allowNull: false },
    onDelete: 'CASCADE',
  });
}
