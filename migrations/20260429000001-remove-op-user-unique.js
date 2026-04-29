'use strict'

module.exports = {
  async up(queryInterface) {
    await queryInterface.removeIndex('events', 'op_user')
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.addIndex('events', ['op_user'], { unique: true, name: 'op_user' })
  },
}
