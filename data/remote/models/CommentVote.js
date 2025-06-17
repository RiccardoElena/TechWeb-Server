import { DataTypes } from 'sequelize';

export function createModel(database) {
  database.define('CommentVote', {
    isUpvote: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
    },
    commentId: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
    },
  });
}
