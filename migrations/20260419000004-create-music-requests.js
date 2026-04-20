'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('music_requests', {
      id: {
        type:       Sequelize.STRING(36),
        primaryKey: true,
        allowNull:  false,
      },
      event_id: {
        type:      Sequelize.STRING(12),
        allowNull: false,
        references: { model: 'events', key: 'id' },
        onDelete:  'CASCADE',
      },
      track_id: {
        type:      Sequelize.STRING(64),
        allowNull: false,
      },
      track_name: {
        type:      Sequelize.STRING(255),
        allowNull: false,
      },
      artist_name: {
        type:      Sequelize.STRING(255),
        allowNull: false,
      },
      album_name: {
        type:      Sequelize.STRING(255),
        allowNull: true,
      },
      album_art: {
        type:      Sequelize.STRING(512),
        allowNull: true,
      },
      preview_url: {
        type:      Sequelize.STRING(512),
        allowNull: true,
      },
      status: {
        type:         Sequelize.ENUM('pending', 'playing', 'done'),
        defaultValue: 'pending',
      },
      requested_at: {
        type:      Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('music_requests', ['event_id', 'requested_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('music_requests');
  },
};
