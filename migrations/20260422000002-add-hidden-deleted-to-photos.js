'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('photos', 'hidden', {
      type:         Sequelize.BOOLEAN,
      allowNull:    false,
      defaultValue: false,
    });
    await queryInterface.addColumn('photos', 'deleted_at', {
      type:      Sequelize.DATE,
      allowNull: true,
      defaultValue: null,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('photos', 'hidden');
    await queryInterface.removeColumn('photos', 'deleted_at');
  },
};
