'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('videos', {
      id:                { type: Sequelize.STRING(60), primaryKey: true },
      event_id:          { type: Sequelize.STRING(12), allowNull: false },
      original_filename: { type: Sequelize.STRING,     allowNull: false },
      filename:          { type: Sequelize.STRING,     allowNull: true },
      url:               { type: Sequelize.STRING,     allowNull: true },
      thumbnail_url:     { type: Sequelize.STRING,     allowNull: true },
      duration:          { type: Sequelize.FLOAT,      allowNull: true },
      status: {
        type:         Sequelize.ENUM('processing', 'ready', 'error'),
        defaultValue: 'processing',
      },
      in_slideshow:  { type: Sequelize.BOOLEAN, defaultValue: false },
      hidden:        { type: Sequelize.BOOLEAN, defaultValue: false },
      deleted_at:    { type: Sequelize.DATE,    allowNull: true },
      timestamp:     { type: Sequelize.STRING,  allowNull: false },
    });
    await queryInterface.addIndex('videos', ['event_id', 'timestamp']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('videos');
  },
};
