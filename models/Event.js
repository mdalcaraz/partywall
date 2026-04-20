module.exports = (sequelize, DataTypes) => {
  return sequelize.define('Event', {
    id: {
      type:       DataTypes.STRING(12),
      primaryKey: true,
    },
    name: {
      type:      DataTypes.STRING,
      allowNull: false,
    },
    date: {
      type:      DataTypes.STRING,
      allowNull: true,
    },
    op_user: {
      type:      DataTypes.STRING,
      allowNull: false,
      unique:    true,
    },
    op_pass: {
      type:      DataTypes.STRING,
      allowNull: false,
    },
    active: {
      type:         DataTypes.BOOLEAN,
      defaultValue: true,
    },
    music_enabled: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    tableName:  'events',
    underscored: true,
    timestamps:  true,
    createdAt:   'created_at',
    updatedAt:   false,
  });
};
