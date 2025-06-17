import { DataTypes } from 'sequelize';
import { createHash } from 'crypto';

export function createModel(database) {
  database.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
      primaryKey: true,
    },
    userName: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    salt: {
      type: DataTypes.STRING(4),
      allowNull: false,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      set(value) {
        const hash = createHash('sha256');
        this.setDataValue(
          'password',
          hash.update(value + this.getDataValue('salt')).digest('hex')
        );
      },
    },
  });
}
