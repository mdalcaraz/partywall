'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('events', {
      id: {
        type:       Sequelize.STRING(12),
        primaryKey: true,
        allowNull:  false,
      },
      name: {
        type:      Sequelize.STRING,
        allowNull: false,
      },
      date: {
        type:      Sequelize.STRING,
        allowNull: true,
      },
      op_user: {
        type:      Sequelize.STRING,
        allowNull: false,
        unique:    true,
      },
      op_pass: {
        type:      Sequelize.STRING,
        allowNull: false,
      },
      active: {
        type:         Sequelize.BOOLEAN,
        defaultValue: true,
      },
      created_at: {
        type:         Sequelize.DATE,
        allowNull:    false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('events');
  },
};
