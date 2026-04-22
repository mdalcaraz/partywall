module.exports = (sequelize, DataTypes) => {
  return sequelize.define('Photo', {
    id: {
      type:       DataTypes.STRING(60),
      primaryKey: true,
    },
    event_id: {
      type:      DataTypes.STRING(12),
      allowNull: false,
    },
    filename: {
      type:      DataTypes.STRING,
      allowNull: false,
    },
    url: {
      type:      DataTypes.STRING,
      allowNull: false,
    },
    timestamp: {
      type:      DataTypes.STRING,
      allowNull: false,
    },
    in_slideshow: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },
  }, {
    tableName:   'photos',
    underscored: true,
    timestamps:  false,
    indexes: [{ fields: ['event_id', 'timestamp'] }],
  });
};
