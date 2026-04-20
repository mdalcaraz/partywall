module.exports = (sequelize, DataTypes) => {
  return sequelize.define('MusicRequest', {
    id: {
      type:       DataTypes.STRING(36),
      primaryKey: true,
    },
    event_id: {
      type:      DataTypes.STRING(12),
      allowNull: false,
    },
    track_id: {
      type:      DataTypes.STRING(64),
      allowNull: false,
    },
    track_name: {
      type:      DataTypes.STRING(255),
      allowNull: false,
    },
    artist_name: {
      type:      DataTypes.STRING(255),
      allowNull: false,
    },
    album_name: {
      type:      DataTypes.STRING(255),
      allowNull: true,
    },
    album_art: {
      type:      DataTypes.STRING(512),
      allowNull: true,
    },
    preview_url: {
      type:      DataTypes.STRING(512),
      allowNull: true,
    },
    status: {
      type:         DataTypes.ENUM('pending', 'playing', 'done'),
      defaultValue: 'pending',
    },
    requested_at: {
      type:      DataTypes.DATE,
      allowNull: false,
    },
  }, {
    tableName:   'music_requests',
    underscored: true,
    timestamps:  false,
    indexes: [{ fields: ['event_id', 'requested_at'] }],
  });
};
