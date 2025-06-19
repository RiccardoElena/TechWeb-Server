import { DataTypes } from 'sequelize';

export function createModel(database) {
  database.define('MemeOfTheDay', {
    memeId: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
    },
  });
}
