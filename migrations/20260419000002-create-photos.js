'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('photos', {
      id: {
        type:       Sequelize.STRING(60),
        primaryKey: true,
        allowNull:  false,
      },
      event_id: {
        type:      Sequelize.STRING(12),
        allowNull: false,
        references: { model: 'events', key: 'id' },
        onDelete:   'CASCADE',
        onUpdate:   'CASCADE',
      },
      filename: {
        type:      Sequelize.STRING,
        allowNull: false,
      },
      url: {
        type:      Sequelize.STRING,
        allowNull: false,
      },
      timestamp: {
        type:      Sequelize.STRING,
        allowNull: false,
      },
      in_slideshow: {
        type:         Sequelize.BOOLEAN,
        defaultValue: true,
      },
    });

    await queryInterface.addIndex('photos', ['event_id', 'timestamp']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('photos');
  },
};
