import { DataTypes } from 'sequelize';

export function createModel(database) {
  database.define('MemeVote', {
    isUpvote: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
    },
    memeId: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
    },
  });
}
