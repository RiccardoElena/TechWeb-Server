import { Sequelize } from 'sequelize';
import { createModel as createCommentModel } from './models/Comment.js';
import { createModel as createCommentVoteModel } from './models/CommentVote.js';
import { createModel as createMemeModel } from './models/Meme.js';
import { createModel as createMemeVoteModel } from './models/MemeVote.js';
import { createModel as createUserModel } from './models/User.js';

import 'dotenv/config.js';

export const database = new Sequelize(process.env.DB_CONNECTION_URI, {
  dialect: process.env.DIALECT,
});

createCommentModel(database);
createCommentVoteModel(database);
createMemeModel(database);
createMemeVoteModel(database);
createUserModel(database);

export const { User, Meme, MemeVote, Comment, CommentVote, Tag } =
  database.models;

/* ---------------------- Associations ------------------------------------ */

// User-Meme 1:N
Meme.User = Meme.belongsTo(User, { foreignKey: { allowNull: false } });
User.Memes = User.hasMany(Meme);

// Meme-MemeVote 1:N
Meme.Votes = Meme.hasMany(MemeVote);
MemeVote.Meme = MemeVote.belongsTo(Meme, { foreignKey: 'memeId' });

// User-MemeVote 1:N
MemeVote.User = MemeVote.belongsTo(User);
User.MemeVotes = User.hasMany(MemeVote, { foreignKey: 'userId' });

// User-Comment 1:N
Comment.User = Comment.belongsTo(User, { foreignKey: { allowNull: false } });
User.Comments = User.hasMany(Comment);

// Meme-Comment 1:N
Meme.Comments = Meme.hasMany(Comment, { foreignKey: { allowNull: false } });
Comment.Meme = Comment.belongsTo(Meme);

// Comment-CommentVote 1:N
Comment.Votes = Comment.hasMany(CommentVote);
CommentVote.Comment = CommentVote.belongsTo(Comment, {
  foreignKey: 'commentId',
});

// User-CommentVote 1:N
CommentVote.User = CommentVote.belongsTo(User, { foreignKey: 'userId' });
User.CommentVotes = User.hasMany(CommentVote);

// Comment-Comment 1:M
Comment.Parent = Comment.belongsTo(Comment, {
  foreignKey: 'parentId',
});
Comment.Children = Comment.hasMany(Comment);

/* ---------------------- Trigger ------------------------------------ */
MemeVote.addHook('afterCreate', async (memeVote, options) => {
  if (memeVote.isUpvote) {
    await memeVote.Meme.increment('upvotes', {
      transaction: options.transaction,
    });
  } else {
    await memeVote.Meme.increment('downvotes', {
      transaction: options.transaction,
    });
  }
});

MemeVote.addHook('afterUpdate', async (memeVote, options) => {
  if (memeVote.previous('isUpvote') && !memeVote.isUpvote) {
    await Promise.all([
      memeVote.Meme.decrement('upvotes', {
        transaction: options.transaction,
      }),
      memeVote.Meme.increment('downvotes', {
        transaction: options.transaction,
      }),
    ]);
  } else if (!memeVote.previous('isUpvote') && memeVote.isUpvote) {
    await Promise.all([
      memeVote.Meme.increment('upvotes', {
        transaction: options.transaction,
      }),
      memeVote.Meme.decrement('downvotes', {
        transaction: options.transaction,
      }),
    ]);
  }
});

MemeVote.addHook('afterDestroy', async (memeVote, options) => {
  if (memeVote.isUpvote) {
    await memeVote.Meme.decrement('upvotes', {
      transaction: options.transaction,
    });
  } else {
    await memeVote.Meme.decrement('downvotes', {
      transaction: options.transaction,
    });
  }
});

database
  .sync
  //{ alter: true } // Uncomment this line to alter the tables automatically
  ()

  .then(() => {
    console.log('Database synced correctly');
  })
  .catch((err) => {
    console.error(
      'Error with database synchronization: ' + err.message,
      err.stack
    );
  });
