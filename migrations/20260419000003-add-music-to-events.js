'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('events', 'music_enabled', {
      type:         Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull:    false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('events', 'music_enabled');
  },
};
