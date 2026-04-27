module.exports = (sequelize, DataTypes) => {
  return sequelize.define('Video', {
    id: {
      type:       DataTypes.STRING(60),
      primaryKey: true,
    },
    event_id: {
      type:      DataTypes.STRING(12),
      allowNull: false,
    },
    original_filename: {
      type:      DataTypes.STRING,
      allowNull: false,
    },
    filename: {
      type:      DataTypes.STRING,
      allowNull: true,
    },
    url: {
      type:      DataTypes.STRING,
      allowNull: true,
    },
    thumbnail_url: {
      type:      DataTypes.STRING,
      allowNull: true,
    },
    duration: {
      type:      DataTypes.FLOAT,
      allowNull: true,
    },
    status: {
      type:         DataTypes.ENUM('processing', 'ready', 'error'),
      defaultValue: 'processing',
    },
    in_slideshow: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },
    hidden: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },
    deleted_at: {
      type:      DataTypes.DATE,
      allowNull: true,
    },
    timestamp: {
      type:      DataTypes.STRING,
      allowNull: false,
    },
  }, {
    tableName:   'videos',
    underscored: true,
    timestamps:  false,
    indexes: [{ fields: ['event_id', 'timestamp'] }],
  });
};
