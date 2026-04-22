'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('music_requests', 'votes', {
      type:         Sequelize.INTEGER,
      allowNull:    false,
      defaultValue: 0,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('music_requests', 'votes');
  },
};
