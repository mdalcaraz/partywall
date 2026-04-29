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
    video_enabled: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },
    location: {
      type:      DataTypes.STRING(255),
      allowNull: true,
    },
    address: {
      type:      DataTypes.STRING(255),
      allowNull: true,
    },
    photo_limit: {
      type:         DataTypes.INTEGER,
      defaultValue: 3,
    },
    photo_window: {
      type:         DataTypes.INTEGER,
      defaultValue: 60,
    },
    music_limit: {
      type:         DataTypes.INTEGER,
      defaultValue: 10,
    },
    music_window: {
      type:         DataTypes.INTEGER,
      defaultValue: 600,
    },
    brand_name: {
      type:         DataTypes.STRING(120),
      defaultValue: 'Top DJ Group',
    },
    brand_logo_url: {
      type:      DataTypes.STRING(512),
      allowNull: true,
    },
    brand_instagram: {
      type:         DataTypes.STRING(100),
      defaultValue: 'topdjgroup',
    },
  }, {
    tableName:  'events',
    underscored: true,
    timestamps:  true,
    createdAt:   'created_at',
    updatedAt:   false,
  });
};
